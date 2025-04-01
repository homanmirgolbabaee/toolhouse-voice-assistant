"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, Square } from "lucide-react";
import logger from "@/utils/logger";
import audioLogger from "@/utils/audioLogger";
import { useLogger } from "@/contexts/LoggerContext";
import performanceUtils from "@/utils/performance";
import ErrorBoundary from "@/components/ErrorBoundary";

interface SimplifiedVoiceRecorderProps {
  onAudioCaptured: (audioBlob: Blob) => Promise<void>;
  isProcessing: boolean;
  activeMicId?: string;
}

function SimplifiedVoiceRecorder({ onAudioCaptured, isProcessing, activeMicId }: SimplifiedVoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  
  // Refs for audio
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  
  // Get the logger utility
  const { logInteraction, logError } = useLogger();

  // Log when component mounts
  useEffect(() => {
    logger.debug('ui', 'SimplifiedVoiceRecorder mounted', { activeMicId });
    
    return () => {
      logger.debug('ui', 'SimplifiedVoiceRecorder unmounted');
      
      // Clean up resources
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      if (audioContextRef.current?.state !== "closed") {
        audioContextRef.current?.close();
      }
    };
  }, [activeMicId]);

  // Track when active mic ID changes
  useEffect(() => {
    if (activeMicId) {
      logger.debug('audio', `Active microphone changed`, { micId: activeMicId });
      audioLogger.logDeviceSelection(activeMicId);
    }
  }, [activeMicId]);

  // Toggle recording
  const toggleRecording = async () => {
    // Don't allow starting a recording if already processing
    if (isProcessing && !isRecording) {
      logger.debug('audio', 'Prevented recording start because processing is in progress');
      return;
    }
    
    logInteraction('microphone-button', isRecording ? 'stop' : 'start');
    
    if (!isRecording) {
      performanceUtils.start('voice-recording');
      await startRecording();
    } else {
      stopRecording();
      const recordingDuration = performanceUtils.end('voice-recording');
      logger.debug('audio', `Recording duration: ${recordingDuration.toFixed(2)}ms`);
    }
  };

  // Start recording
  const startRecording = async () => {
    try {
      logger.debug('audio', 'Starting voice recording');
      
      // Reset audio chunks
      audioChunksRef.current = [];
      recordingStartTimeRef.current = performance.now();
      
      // Get audio stream - use specified microphone if available
      const constraints: MediaStreamConstraints = {
        audio: activeMicId
          ? {
              deviceId: { exact: activeMicId },
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          : true
      };
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        audioLogger.logMicrophoneAccess(true);
        
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
        
        audioLogger.logRecordingStart(activeMicId);
      } catch (error) {
        audioLogger.logMicrophoneAccess(false, error);
        throw error;
      }
    } catch (error) {
      logError(error as Error, 'SimplifiedVoiceRecorder', { context: 'startRecording' });
      logger.error("audio", "Error starting recording:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (!mediaRecorderRef.current) {
      logger.warn('audio', 'Attempted to stop recording but no MediaRecorder exists');
      return;
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
          audioLogger.logRecordingStop(durationMs, audioBlob.size);
          
          if (audioBlob.size > 0) {
            try {
              performanceUtils.start('process-audio');
              await onAudioCaptured(audioBlob);
              performanceUtils.end('process-audio');
            } catch (error) {
              logError(error as Error, 'SimplifiedVoiceRecorder', { context: 'processAudio' });
              logger.error('audio', 'Error processing captured audio:', error);
            }
          } else {
            logger.warn('audio', 'Audio blob is empty, not processing');
          }
        } else {
          logger.warn('audio', 'No audio chunks recorded');
        }
      };
    } else {
      logger.debug('audio', `Recording not stopped because state is ${mediaRecorderRef.current.state}`);
    }
    
    setIsRecording(false);
    setAudioLevel(0);
  };

  // Update audio level for visualization
  const updateAudioLevel = () => {
    if (!analyserRef.current) {
      logger.warn('audio', 'Cannot update audio level: no analyzer available');
      return;
    }
    
    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    let lastLogTime = 0;
    const LOG_INTERVAL = 500; // Log audio levels every 500ms
    
    const updateLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume level (0-1)
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      const normalized = Math.min(average / 128, 1); // 0-1 scale
      
      setAudioLevel(normalized);
      
      // Log audio levels occasionally
      const now = performance.now();
      if (now - lastLogTime > LOG_INTERVAL) {
        audioLogger.logAudioLevel(normalized, Math.max(...Array.from(dataArray)) / 255, average / 255);
        lastLogTime = now;
      }
      
      // Continue animation loop
      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };
    
    animationFrameRef.current = requestAnimationFrame(updateLevel);
  };

  // Calculate dynamic styles based on audio level
  const getMicSize = () => {
    // Base size + expansion based on audio level
    return isRecording ? `scale(${1 + audioLevel * 0.3})` : "scale(1)";
  };

  const getMicColor = () => {
    if (!isRecording) return "rgb(59, 130, 246)"; // Blue when not recording
    
    // When recording: intensity increases with audio level
    const intensity = Math.floor(200 + audioLevel * 55);
    return isRecording ? `rgb(239, ${intensity}, ${intensity})` : "rgb(239, 68, 68)";
  };

  return (
    <ErrorBoundary componentName="SimplifiedVoiceRecorder">
      <div className="relative flex flex-col items-center">
        {/* Debug info in development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="absolute top-0 left-0 -mt-6 text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-md opacity-50 hover:opacity-100 transition-opacity">
            Level: {(audioLevel * 100).toFixed(0)}%
          </div>
        )}
        
        <button
          onClick={toggleRecording}
          disabled={isProcessing && !isRecording}
          className="relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-100 focus:outline-none text-white shadow-lg"
          style={{
            backgroundColor: getMicColor(),
            transform: getMicSize(),
            transition: "transform 0.1s ease-out, background-color 0.1s ease-out"
          }}
          aria-label={isRecording ? "Stop recording" : "Start recording"}
          data-testid="voice-recorder-button"
        >
          {isRecording ? (
            <Square size={24} />
          ) : (
            <Mic size={24} />
          )}
        </button>
        
        {/* Ring indicators for audio level */}
        {isRecording && (
          <>
            <div 
              className="absolute rounded-full border-4 border-red-300 pointer-events-none"
              style={{
                width: `${100 + audioLevel * 60}%`,
                height: `${100 + audioLevel * 60}%`,
                opacity: 0.3 + audioLevel * 0.5,
                transition: "all 0.1s ease-out"
              }}
            />
            <div 
              className="absolute rounded-full border-2 border-red-400 pointer-events-none"
              style={{
                width: `${120 + audioLevel * 80}%`,
                height: `${120 + audioLevel * 80}%`,
                opacity: 0.2 + audioLevel * 0.3,
                transition: "all 0.15s ease-out"
              }}
            />
          </>
        )}
        
        <div className="mt-2 text-sm font-medium">
          {isRecording ? "Tap to stop" : "Tap to record"}
        </div>
      </div>
    </ErrorBoundary>
  );
}

// Wrap the component with ErrorBoundary at the export level
export default function SimplifiedVoiceRecorderWithErrorHandling(props: SimplifiedVoiceRecorderProps) {
  return (
    <ErrorBoundary componentName="SimplifiedVoiceRecorderRoot">
      <SimplifiedVoiceRecorder {...props} />
    </ErrorBoundary>
  );
}