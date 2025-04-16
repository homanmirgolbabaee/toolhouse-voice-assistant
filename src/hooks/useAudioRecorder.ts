// src/hooks/useAudioRecorder.ts

import { useState, useRef, useEffect } from 'react';
import logger from '@/utils/logger';

export interface AudioRecorderOptions {
  onAudioCaptured?: (blob: Blob) => Promise<void>;
  deviceId?: string;
  onAudioLevelChange?: (level: number) => void;
}

export function useAudioRecorder({
  onAudioCaptured,
  deviceId,
  onAudioLevelChange
}: AudioRecorderOptions = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  // Refs for audio handling
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up resources on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      if (audioContextRef.current?.state !== "closed") {
        audioContextRef.current?.close();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Toggle recording state
  const toggleRecording = async () => {
    if (!isRecording) {
      await startRecording();
    } else {
      stopRecording();
    }
  };

  // Start recording
  const startRecording = async () => {
    try {
      logger.debug('audio', 'Starting voice recording');
      
      // Reset audio chunks and state
      audioChunksRef.current = [];
      recordingStartTimeRef.current = performance.now();
      setRecordingDuration(0);
      
      // Start a timer to update the duration display
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
      // Get audio stream with specified device if available
      const constraints: MediaStreamConstraints = {
        audio: deviceId
          ? {
              deviceId: { exact: deviceId },
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          : {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Create audio analyzer for visualization
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      
      // Create media recorder with reliable settings
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      mediaRecorderRef.current = mediaRecorder;
      
      // Collect audio data
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          logger.debug('audio', `Audio chunk added: ${event.data.size} bytes`);
        }
      };
      
      // Start recording
      mediaRecorder.start(100);
      setIsRecording(true);
      
      // Start audio level visualization
      updateAudioLevel();
      
      logger.info('audio', "Recording started", { 
        micId: deviceId || "default",
        audioTracks: stream.getAudioTracks().length,
        audioSettings: stream.getAudioTracks()[0]?.getSettings()
      });
    } catch (error) {
      logger.error("audio", "Error starting recording:", error);
      throw new Error(`Could not access microphone: ${(error as Error).message}`);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (!mediaRecorderRef.current) {
      logger.warn('audio', 'Attempted to stop recording but no MediaRecorder exists');
      return;
    }
    
    // Stop the timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Stop audio level visualization
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Only stop if recording
    if (mediaRecorderRef.current.state === "recording") {
      logger.debug('audio', 'Stopping recording');
      mediaRecorderRef.current.stop();
      
      // Process the recording when stopped
      mediaRecorderRef.current.onstop = async () => {
        // Stop all tracks
        mediaRecorderRef.current?.stream.getTracks().forEach(track => track.stop());
        
        // Process audio
        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          const durationMs = performance.now() - recordingStartTimeRef.current;
          
          logger.debug('audio', `Audio recorded, size: ${audioBlob.size} bytes, duration: ${durationMs.toFixed(0)}ms`);
          
          if (audioBlob.size > 0) {
            try {
              setIsProcessing(true);
              
              if (onAudioCaptured) {
                await onAudioCaptured(audioBlob);
              }
            } catch (error) {
              logger.error('audio', 'Error processing captured audio:', error);
              throw error;
            } finally {
              setIsProcessing(false);
            }
          } else {
            logger.warn('audio', 'Audio blob is empty, not processing');
          }
        } else {
          logger.warn('audio', 'No audio chunks recorded');
        }
      };
    }
    
    setIsRecording(false);
    setAudioLevel(0);
  };

  // Update audio level for visualization
  const updateAudioLevel = () => {
    if (!analyserRef.current) {
      return;
    }
    
    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const updateLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume level (0-1)
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      const normalized = Math.min(average / 128, 1); // 0-1 scale
      
      setAudioLevel(normalized);
      if (onAudioLevelChange) {
        onAudioLevelChange(normalized);
      }
      
      // Continue animation loop
      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };
    
    animationFrameRef.current = requestAnimationFrame(updateLevel);
  };

  // Format time for display (mm:ss)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    isRecording,
    isProcessing,
    audioLevel,
    recordingDuration,
    formattedDuration: formatTime(recordingDuration),
    startRecording,
    stopRecording,
    toggleRecording
  };
}

export default useAudioRecorder;