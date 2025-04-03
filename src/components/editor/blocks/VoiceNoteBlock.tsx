// components/editor/blocks/VoiceNoteBlock.tsx
import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, Pause, Trash2 } from "lucide-react";
import audioLogger from "@/utils/audioLogger";
import logger from "@/utils/logger";
import performanceUtils from "@/utils/performance";

interface VoiceNoteBlockProps {
  id: string;
  content: string; // This will store the audio URL
  isActive: boolean;
  onChange: (content: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  readOnly?: boolean;
}

const VoiceNoteBlock: React.FC<VoiceNoteBlockProps> = ({
  id,
  content,
  isActive,
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  readOnly = false
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedDuration, setRecordedDuration] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element if we have content
  useEffect(() => {
    if (content && !audioRef.current) {
      audioRef.current = new Audio(content);
      
      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false);
      });
      
      // Get the audio duration
      audioRef.current.addEventListener('loadedmetadata', () => {
        if (audioRef.current) {
          setRecordedDuration(Math.floor(audioRef.current.duration));
        }
      });
    }
    
    return () => {
      // Clean up
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, [content]);

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

  // Toggle recording
  const toggleRecording = async () => {
    if (!isRecording) {
      performanceUtils.start('voice-recording');
      await startRecording();
    } else {
      stopRecording();
      const recordingDuration = performanceUtils.end('voice-recording');
      logger.debug('audio', `Recording duration: ${recordingDuration?.toFixed(2) ?? 'unknown'}ms`);
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
      
      // Get audio stream
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
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
      
      logger.info('audio', "Voice note recording started");
      audioLogger.logRecordingStart();
    } catch (error) {
      audioLogger.logMicrophoneAccess(false, error);
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
          setRecordedDuration(Math.floor(durationMs / 1000));
          
          logger.debug('audio', `Audio recorded, size: ${audioBlob.size} bytes, duration: ${durationMs.toFixed(0)}ms`);
          audioLogger.logRecordingStop(durationMs, audioBlob.size);
          
          if (audioBlob.size > 0) {
            try {
              // Create a URL for the audio blob
              const audioUrl = URL.createObjectURL(audioBlob);
              
              // Update the content with the new audio URL
              onChange(audioUrl);
              
              // Create a new audio element for playback
              if (audioRef.current) {
                audioRef.current.src = audioUrl;
              } else {
                audioRef.current = new Audio(audioUrl);
                audioRef.current.addEventListener('ended', () => {
                  setIsPlaying(false);
                });
              }
              
              logger.debug('audio', 'Audio URL created and saved');
            } catch (error) {
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

  // Toggle audio playback
  const togglePlayback = () => {
    if (!audioRef.current || !content) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  // Delete the recording
  const deleteRecording = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    
    onChange(''); // Clear the content
    setIsPlaying(false);
    setRecordedDuration(0);
  };

  // Format seconds to mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // If no content, show recording interface
  if (!content) {
    return (
      <div
        id={`block-${id}`}
        className={`flex items-center py-3 px-4 rounded-md ${
          isActive ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
        }`}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        tabIndex={0}
        data-block-type="audio"
      >
        <div className="flex-1 flex items-center">
          <div className="relative w-12 h-12 mr-4">
            {/* Audio level indicator rings */}
            {isRecording && (
              <>
                <div 
                  className="absolute inset-0 rounded-full border-4 border-red-400/70 pointer-events-none"
                  style={{
                    transform: `scale(${1 + audioLevel * 0.5})`,
                    opacity: 0.7 - audioLevel * 0.3,
                    transition: "all 0.2s ease-out"
                  }}
                />
                <div 
                  className="absolute inset-0 rounded-full border-2 border-red-300/50 pointer-events-none"
                  style={{
                    transform: `scale(${1 + audioLevel * 0.8})`,
                    opacity: 0.5 - audioLevel * 0.2,
                    transition: "all 0.25s ease-out"
                  }}
                />
              </>
            )}
            
            <button
              onClick={toggleRecording}
              disabled={readOnly}
              className="absolute inset-0 rounded-full flex items-center justify-center transition-all duration-100 focus:outline-none text-white shadow-lg"
              style={{
                backgroundColor: isRecording ? "rgb(239, 68, 68)" : "rgb(59, 130, 246)",
                transform: isRecording ? `scale(${1 + audioLevel * 0.3})` : "scale(1)",
                transition: "transform 0.1s ease-out, background-color 0.1s ease-out"
              }}
            >
              {isRecording ? (
                <Square size={24} />
              ) : (
                <Mic size={24} />
              )}
            </button>
          </div>
          
          <div className="flex-1">
            {isRecording ? (
              <div className="flexitems-center">
                <div className="text-red-600 font-medium">Recording: {formatTime(recordingDuration)}</div>
                <div className="ml-2 w-2 h-2 rounded-full bg-red-600 animate-pulse"></div>
              </div>
            ) : (
              <div className="text-gray-600 dark:text-gray-300">
                Click to record a voice note
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // If we have content, show playback interface
  return (
    <div
      id={`block-${id}`}
      className={`flex items-center py-3 px-4 rounded-md ${
        isActive ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
      }`}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      tabIndex={0}
      data-block-type="audio"
    >
      <div className="flex-1 flex items-center">
        <button
          onClick={togglePlayback}
          disabled={readOnly}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-600 text-white shadow-md mr-3 hover:bg-blue-700 transition-colors"
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        
        <div className="flex-1">
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            {/* Simple audio progress bar */}
            {audioRef.current && (
              <div 
                className="h-full bg-blue-600"
                style={{ 
                  width: isPlaying && audioRef.current && recordedDuration > 0
                    ? `${(audioRef.current.currentTime / recordedDuration) * 100}%`
                    : '0%'
                }}
              />
            )}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            {formatTime(recordedDuration)}
          </div>
        </div>
        
        {!readOnly && (
          <button
            onClick={deleteRecording}
            className="ml-3 p-2 text-gray-500 hover:text-red-600 transition-colors"
            title="Delete recording"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

export default VoiceNoteBlock;