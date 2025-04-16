// src/components/SimplifiedVoiceRecorder.tsx

import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, AlertCircle } from "lucide-react";
import logger from "@/utils/logger";
import ErrorBoundary from "@/components/ErrorBoundary";

interface SimplifiedVoiceRecorderProps {
  onAudioCaptured: (blob: Blob) => Promise<void>;
  isProcessing: boolean;
  activeMicId?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
}

function SimplifiedVoiceRecorder({ 
  onAudioCaptured, 
  isProcessing, 
  activeMicId,
  size = 'md',
  className = "",
  disabled = false
}: SimplifiedVoiceRecorderProps) {
  // Local state for UI-specific behavior
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  
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

  // Update timer during recording
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecordingTime(0);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isRecording]);

  // Toggle recording state
  const toggleRecording = async () => {
    if (disabled || isProcessing) return;
    
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
      setRecordingError(null);
      
      // Reset audio chunks and state
      audioChunksRef.current = [];
      recordingStartTimeRef.current = performance.now();
      setRecordingTime(0);
      
      // Get audio stream with specified device if available
      const constraints: MediaStreamConstraints = {
        audio: activeMicId
          ? {
              deviceId: { exact: activeMicId },
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
        micId: activeMicId || "default",
        audioTracks: stream.getAudioTracks().length,
        audioSettings: stream.getAudioTracks()[0]?.getSettings()
      });
    } catch (error) {
      logger.error("audio", "Error starting recording:", error);
      setRecordingError(`Could not access microphone: ${(error as Error).message}`);
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
              setRecordingError(null);
              await onAudioCaptured(audioBlob);
            } catch (error) {
              setRecordingError((error as Error).message);
              logger.error('audio', 'Error processing captured audio:', error);
            }
          } else {
            setRecordingError('Audio recorded is empty. Please try again.');
            logger.warn('audio', 'Audio blob is empty, not processing');
          }
        } else {
          setRecordingError('No audio recorded. Please try again.');
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

  // Determine button size
  const buttonSize = {
    sm: {
      button: "w-8 h-8",
      icon: 14
    },
    md: {
      button: "w-10 h-10",
      icon: 18
    },
    lg: {
      button: "w-12 h-12",
      icon: 22
    }
  }[size];

  // Render recording time indicator
  const renderRecordingTime = () => {
    if (!isRecording) return null;
    
    return (
      <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-red-500 text-white text-xs font-medium py-0.5 px-2 rounded-full animate-pulse flex items-center">
        <span className="w-1.5 h-1.5 bg-white rounded-full mr-1"></span>
        {formatTime(recordingTime)}
      </div>
    );
  };

  return (
    <div className={`relative flex flex-col items-center ${className}`}>
      {/* Recording time indicator */}
      {renderRecordingTime()}
      
      <div className="relative">
        {/* Audio level indicator rings */}
        {isRecording && (
          <>
            <div 
              className="absolute inset-0 rounded-full border-2 border-red-400/50 pointer-events-none"
              style={{
                transform: `scale(${1 + audioLevel * 0.5})`,
                opacity: 0.5 - audioLevel * 0.2,
                transition: "all 0.2s ease-out"
              }}
            />
            <div 
              className="absolute inset-0 rounded-full border border-red-300/30 pointer-events-none"
              style={{
                transform: `scale(${1 + audioLevel * 0.8})`,
                opacity: 0.3 - audioLevel * 0.1,
                transition: "all 0.2s ease-out"
              }}
            />
          </>
        )}
        
        {/* Processing state overlay */}
        {isProcessing && !isRecording && (
          <div className="absolute inset-0 rounded-full bg-gray-500/50 flex items-center justify-center z-10">
            <div className="w-2/3 h-2/3 border-4 border-t-blue-500 border-gray-200 rounded-full animate-spin"></div>
          </div>
        )}
        
        {/* Main button */}
        <button
          onClick={toggleRecording}
          disabled={disabled || (isProcessing && !isRecording)}
          className={`${buttonSize.button} rounded-full flex items-center justify-center transition-all duration-100 focus:outline-none text-white shadow-lg ${
            isRecording 
              ? 'bg-red-500 text-white' 
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
          } ${(disabled || (isProcessing && !isRecording)) ? 'opacity-50 cursor-not-allowed' : ''}`}
          style={{
            transform: isRecording ? `scale(${1 + audioLevel * 0.2})` : 'scale(1)',
          }}
          title={isRecording ? "Stop recording" : "Record voice message"}
          data-testid="voice-recorder-button"
        >
          {isRecording ? (
            <Square size={buttonSize.icon} />
          ) : (
            <Mic size={buttonSize.icon} />
          )}
        </button>
      </div>
      
      {/* Error message */}
      {recordingError && (
        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs rounded-md flex items-start">
          <AlertCircle size={14} className="mr-1 mt-0.5 flex-shrink-0" />
          <span>{recordingError}</span>
        </div>
      )}
    </div>
  );
}

// Export with error boundary wrapper
export default function VoiceRecorderWithErrorHandling(props: SimplifiedVoiceRecorderProps) {
  return (
    <ErrorBoundary componentName="SimplifiedVoiceRecorderRoot">
      <SimplifiedVoiceRecorder {...props} />
    </ErrorBoundary>
  );
}