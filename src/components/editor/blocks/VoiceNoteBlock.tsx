// components/editor/blocks/VoiceNoteBlock.tsx
import React, { useState, useRef, useEffect } from "react";
import { Mic, Square, Play, Pause, Trash2, Volume2, VolumeX, Download, Save } from "lucide-react";
import audioLogger from "@/utils/audioLogger";
import logger from "@/utils/logger";
import performanceUtils from "@/utils/performance";

interface VoiceNoteBlockProps {
  id: string;
  content: string; // This stores the audio URL or base64 data
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
  const [currentPlayTime, setCurrentPlayTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const recordingStartTimeRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioUrl = useRef<string | null>(null);

  // Helper to check if content is a blob URL or base64 data
  const isBase64 = (str: string): boolean => {
    return str.startsWith('data:audio');
  };

  const isBlobUrl = (str: string): boolean => {
    return str.startsWith('blob:');
  };

  // Helper to create an audio element with proper source
  const createAudioElement = (src: string): HTMLAudioElement => {
    const audio = new Audio();
    audio.src = src;
    return audio;
  };

  // Convert blob to base64 for persistent storage
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Convert base64 to blob for playback
  const base64ToBlob = (base64: string): Promise<Blob> => {
    return fetch(base64)
      .then(res => res.blob())
      .then(blob => {
        // Return a blob with the correct mime type
        return new Blob([blob], { type: 'audio/webm;codecs=opus' });
      });
  };

  // Initialize audio when content changes or component mounts
  useEffect(() => {
    const initializeAudio = async () => {
      try {
        if (!content || content.trim() === "") return;
        
        // Clean up existing audio element and URL
        cleanupAudio();
        
        let audioSource = content;
        
        // If content is base64, convert to blob URL for playback
        if (isBase64(content)) {
          try {
            setIsConverting(true);
            const blob = await base64ToBlob(content);
            audioSource = URL.createObjectURL(blob);
            audioUrl.current = audioSource;
            setIsConverting(false);
          } catch (error) {
            logger.error('audio', 'Error converting base64 to blob:', error);
            setAudioError('Failed to load audio data');
            setIsConverting(false);
            return;
          }
        } else if (!isBlobUrl(content)) {
          // If not base64 or blob URL, it might be invalid
          setAudioError('Invalid audio format');
          return;
        } else {
          audioUrl.current = content;
        }
        
        // Create and set up the audio element
        audioRef.current = createAudioElement(audioSource);
        
        // Set up event listeners
        setupAudioListeners();
        
        // Set volume
        if (audioRef.current) {
          audioRef.current.volume = volume;
        }
        
        // Clear any previous error
        setAudioError(null);
      } catch (error) {
        const errorMsg = (error as Error).message;
        setAudioError(errorMsg);
        logger.error('audio', 'Error setting up audio element:', error);
      }
    };
    
    initializeAudio();
    
    // Cleanup on unmount or when content changes
    return cleanupAudio;
  }, [content, volume]);

  // Clean up resources on unmount
  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, []);

  // Clean up audio resources
  const cleanupAudio = () => {
    try {
      if (audioRef.current) {
        // Remove all event listeners
        audioRef.current.onended = null;
        audioRef.current.onloadedmetadata = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
        
        // Use empty src to free resources
        audioRef.current.src = '';
      }
      
      // Clear any playback state
      setIsPlaying(false);
      
      // Clear timer
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
      
      // Revoke any blob URL we created (but not the original content)
      if (audioUrl.current && audioUrl.current !== content) {
        URL.revokeObjectURL(audioUrl.current);
        audioUrl.current = null;
      }
    } catch (error) {
      logger.error('audio', 'Error cleaning up audio:', error);
    }
  };

  // Clean up all resources
  const cleanupResources = () => {
    try {
      // Clean up audio
      cleanupAudio();
      
      // Clean up recording resources
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
    } catch (error) {
      logger.error('audio', 'Error cleaning up resources:', error);
    }
  };

  // Set up audio event listeners
  const setupAudioListeners = () => {
    if (!audioRef.current) return;
    
    // Handle playback end
    audioRef.current.onended = () => {
      setIsPlaying(false);
      setCurrentPlayTime(0);
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    };
    
    // Handle metadata loaded (duration)
    audioRef.current.onloadedmetadata = () => {
      if (audioRef.current) {
        setRecordedDuration(Math.floor(audioRef.current.duration));
        logger.debug('audio', `Audio loaded, duration: ${audioRef.current.duration}`);
      }
    };
    
    // Handle errors
    audioRef.current.onerror = (e) => {
      const errorMsg = audioRef.current?.error?.message || "Unknown audio error";
      setAudioError(errorMsg);
      logger.error('audio', 'Audio error:', { 
        error: e, 
        code: audioRef.current?.error?.code,
        message: errorMsg
      });
    };
  };

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
      setAudioError(`Could not access microphone: ${(error as Error).message}`);
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
              // Convert blob to base64 for persistent storage
              setIsConverting(true);
              const base64Data = await blobToBase64(audioBlob);
              
              // Create a temporary blob URL for immediate playback
              const tempUrl = URL.createObjectURL(audioBlob);
              audioUrl.current = tempUrl;
              
              // Update the audio element
              if (audioRef.current) {
                audioRef.current.src = tempUrl;
                setupAudioListeners();
              } else {
                audioRef.current = createAudioElement(tempUrl);
                setupAudioListeners();
              }
              
              // Update the content with the base64 data for persistent storage
              onChange(base64Data);
              setIsConverting(false);
              
              logger.debug('audio', 'Audio converted to base64 for storage');
            } catch (error) {
              setAudioError(`Failed to process audio: ${(error as Error).message}`);
              logger.error('audio', 'Error processing captured audio:', error);
              setIsConverting(false);
            }
          } else {
            setAudioError('Recorded audio is empty');
            logger.warn('audio', 'Audio blob is empty, not processing');
          }
        } else {
          setAudioError('No audio recorded');
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
    if (!audioRef.current) return;
    
    if (isPlaying) {
      try {
        audioRef.current.pause();
        setIsPlaying(false);
        if (playTimerRef.current) {
          clearInterval(playTimerRef.current);
          playTimerRef.current = null;
        }
      } catch (error) {
        logger.error('audio', 'Error pausing audio:', error);
      }
    } else {
      try {
        // Create a new promise to handle play errors
        const playPromise = audioRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise.then(() => {
            // Playback started successfully
            setIsPlaying(true);
            setAudioError(null);
            
            // Start timer to update playback position
            playTimerRef.current = setInterval(() => {
              if (audioRef.current) {
                setCurrentPlayTime(Math.floor(audioRef.current.currentTime));
              }
            }, 1000);
          }).catch(error => {
            // Handle any errors during playback
            const errorMsg = (error as Error).message;
            setAudioError(`Playback error: ${errorMsg}`);
            logger.error('audio', 'Playback error:', error);
            
            // Try recreating the audio element if we have a blob URL
            if (audioUrl.current) {
              try {
                audioRef.current = new Audio(audioUrl.current);
                audioRef.current.volume = volume;
                setupAudioListeners();
                
                // Try playing again
                audioRef.current.play().catch(secondErr => {
                  logger.error('audio', 'Second playback error:', secondErr);
                  setAudioError(`Could not play audio: ${(secondErr as Error).message}`);
                });
              } catch (recreationError) {
                logger.error('audio', 'Failed to recreate audio element:', recreationError);
              }
            }
          });
        }
      } catch (error) {
        const errorMsg = (error as Error).message;
        setAudioError(`Error playing audio: ${errorMsg}`);
        logger.error('audio', 'Error playing audio:', error);
      }
    }
  };

  // Toggle mute
  const toggleMute = () => {
    if (!audioRef.current) return;
    
    try {
      if (isMuted) {
        audioRef.current.volume = volume;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    } catch (error) {
      logger.error('audio', 'Error toggling mute:', error);
    }
  };

  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    
    if (audioRef.current) {
      try {
        audioRef.current.volume = newVolume;
        if (newVolume === 0) {
          setIsMuted(true);
        } else if (isMuted) {
          setIsMuted(false);
        }
      } catch (error) {
        logger.error('audio', 'Error setting volume:', error);
      }
    }
  };

  // Download the audio recording
  const downloadRecording = () => {
    if (!content) return;
    
    try {
      // If content is base64, convert to blob first
      if (isBase64(content)) {
        base64ToBlob(content).then(blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `voice-note-${id}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }).catch(error => {
          logger.error('audio', 'Error converting base64 to blob for download:', error);
          setAudioError('Failed to download recording');
        });
      } else if (audioUrl.current) {
        // If we have a blob URL, use it directly
        const a = document.createElement('a');
        a.href = audioUrl.current;
        a.download = `voice-note-${id}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (error) {
      logger.error('audio', 'Error downloading recording:', error);
    }
  };

  // Delete the recording
  const deleteRecording = () => {
    try {
      // First stop any playback
      if (audioRef.current) {
        // Remove error listeners before changing src to prevent error events
        const handleError = () => {}; // Empty handler to replace any existing ones
        audioRef.current.onerror = handleError;
        
        // Pause playback
        audioRef.current.pause();
        
        // Change src (this won't trigger errors with the above handler)
        audioRef.current.src = '';
      }
      
      // Revoke the blob URL to free memory
      if (audioUrl.current) {
        try {
          URL.revokeObjectURL(audioUrl.current);
          audioUrl.current = null;
        } catch (e) {
          // Ignore errors when revoking URLs
        }
      }
      
      // Update state
      onChange(''); // Clear the content
      setIsPlaying(false);
      setRecordedDuration(0);
      setCurrentPlayTime(0);
      setAudioError(null);
      
      // Clear any timers
      if (playTimerRef.current) {
        clearInterval(playTimerRef.current);
        playTimerRef.current = null;
      }
    } catch (error) {
      logger.error('audio', 'Error deleting recording:', error);
    }
  };

  // Format seconds to mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage for the progress bar
  const calculateProgress = () => {
    if (!audioRef.current || recordedDuration === 0) return 0;
    return (currentPlayTime / recordedDuration) * 100;
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
              <div className="flex items-center">
                <div className="text-red-600 dark:text-red-400 font-medium">Recording: {formatTime(recordingDuration)}</div>
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
      className={`flex flex-col py-3 px-4 rounded-md ${
        isActive ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
      }`}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      tabIndex={0}
      data-block-type="audio"
    >
      {/* Show errors if any */}
      {audioError && (
        <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded flex items-start">
          <AlertCircle size={16} className="mr-1 mt-0.5 flex-shrink-0" />
          <p>{audioError}</p>
        </div>
      )}
      
      {/* Show loading state during conversion */}
      {isConverting && (
        <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-sm rounded flex items-center justify-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 dark:border-blue-400 mr-2"></div>
          <p>Processing audio...</p>
        </div>
      )}
      
      {/* Audio player controls */}
      <div className="flex items-center">
        <button
          onClick={togglePlayback}
          disabled={readOnly || isConverting}
          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-md mr-3 transition-colors flex-shrink-0 ${
            isPlaying 
              ? 'bg-blue-600 text-white hover:bg-blue-700' 
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          } ${isConverting ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        
        <div className="flex-1">
          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
            <span>{formatTime(currentPlayTime)}</span>
            <span>{formatTime(recordedDuration)}</span>
          </div>
          
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
            {/* Progress bar */}
            <div 
              className="h-full bg-blue-600 absolute top-0 left-0"
              style={{ width: `${calculateProgress()}%` }}
            />
          </div>
        </div>
        
        {/* Volume control */}
        <div className="flex items-center ml-3">
          <button
            onClick={toggleMute}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={handleVolumeChange}
            className="w-16 h-1"
          />
        </div>
      </div>
      
      {/* Controls */}
      <div className="flex justify-between mt-2 space-x-2">
        <div className="flex-1"></div>
        
        <button
          onClick={downloadRecording}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 p-1"
          title="Download recording"
        >
          <Download size={16} />
        </button>
        
        {!readOnly && (
          <button
            onClick={deleteRecording}
            className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 p-1"
            title="Delete recording"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

// Helper component for error boundary
const AlertCircle = ({ size = 24, className = "" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

export default VoiceNoteBlock;