// src/components/TextSelectionTTS.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Volume2, Loader2, X, Settings, ChevronDown, Check, VolumeX } from 'lucide-react';
import { useTTS } from '@/contexts/TTSContext';
import { generateSpeech, playAudio, Voice, ELEVENLABS_VOICES } from '@/utils/elevenLabsTTS';
import logger from '@/utils/logger';

export default function TextSelectionTTS() {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showVoiceSelector, setShowVoiceSelector] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Get TTS context values
  const { 
    apiKey, 
    selectedVoice, 
    setSelectedVoice, 
    isTTSEnabled 
  } = useTTS();
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const voiceMenuRef = useRef<HTMLDivElement>(null);
  const selectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle text selection
  useEffect(() => {
    const checkSelection = () => {
      // Clear any existing timeout
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
      
      // Use a small timeout to allow the selection to stabilize
      selectionTimeoutRef.current = setTimeout(() => {
        const selection = window.getSelection();
        
        if (!selection || selection.isCollapsed) {
          // No selection or collapsed selection (cursor)
          if (!isPlaying && !isLoading) {
            setIsVisible(false);
          }
          return;
        }
        
        const text = selection.toString().trim();
        if (text && text.length > 3) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          
          // Calculate position for the TTS button
          const x = rect.left + rect.width / 2;
          const y = rect.bottom + window.scrollY + 10; // 10px below the selection
          
          setPosition({ x, y });
          setSelectedText(text);
          setIsVisible(true);
          
          // Log that selection was detected
          logger.debug('tts', 'Text selection detected', {
            textLength: text.length,
            position: { x, y }
          });
        } else {
          if (!isPlaying && !isLoading) {
            setIsVisible(false);
          }
        }
      }, 100);
    };

    // Check selection on mouseup and keyup
    document.addEventListener('mouseup', checkSelection);
    document.addEventListener('keyup', checkSelection);
    
    return () => {
      document.removeEventListener('mouseup', checkSelection);
      document.removeEventListener('keyup', checkSelection);
      if (selectionTimeoutRef.current) {
        clearTimeout(selectionTimeoutRef.current);
      }
    };
  }, [isPlaying, isLoading]);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Only hide popup if not playing/loading and clicked outside
      if (containerRef.current && !containerRef.current.contains(e.target as Node) && !isPlaying && !isLoading) {
        setIsVisible(false);
      }
      
      // Close voice selector dropdown
      if (voiceMenuRef.current && !voiceMenuRef.current.contains(e.target as Node)) {
        setShowVoiceSelector(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPlaying, isLoading]);

  // Clean up audio when component unmounts
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const playTextToSpeech = async () => {
    if (!selectedText || !apiKey) {
      setError("Missing API key or selected text");
      return;
    }
    
    // Validate text length to avoid hitting API limits
    if (selectedText.length > 5000) {
      setError(`Selected text is too long (${selectedText.length} characters). Please select less than 5000 characters.`);
      return;
    }
    
    setError(null);
    
    try {
      setIsLoading(true);
      
      // Stop any existing playback
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      
      // Log the request to debug
      logger.debug('tts', 'Generating speech for selected text', {
        textLength: selectedText.length,
        voiceId: selectedVoice.id
      });
      
      // Generate speech using ElevenLabs
      const audioBlob = await generateSpeech({
        text: selectedText,
        voiceId: selectedVoice.id,
        apiKey: apiKey
      });
      
      // Create audio element
      const audio = new Audio();
      audio.src = URL.createObjectURL(audioBlob);
      
      // Set up audio events
      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audio.src);
      };
      audio.onpause = () => setIsPlaying(false);
      audio.onerror = (e) => {
        logger.error('audio', 'Error playing TTS audio', e);
        setIsPlaying(false);
        setIsLoading(false);
        setError("Error playing audio");
      };
      
      // Store reference and play
      audioRef.current = audio;
      await audio.play();
      
      setIsLoading(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('audio', 'Error generating speech', error);
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const selectVoice = (voice: Voice) => {
    setSelectedVoice(voice);
    setShowVoiceSelector(false);
  };

  // Don't show if TTS is disabled or no API key is available
  if (!isTTSEnabled || !apiKey) {
    return null;
  }

  if (!isVisible && !isPlaying && !isLoading) {
    return null;
  }

  return (
    <div 
      ref={containerRef}
      className="fixed z-50 animate-fade-in tts-selection-popup"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translateX(-50%)'
      }}
    >
      <div className="flex items-center bg-gray-800 rounded-full shadow-lg border border-gray-700 text-white">
        {/* Voice selector */}
        <div className="relative">
          <button
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-300 hover:text-white"
            onClick={() => setShowVoiceSelector(!showVoiceSelector)}
          >
            {selectedVoice.name} <ChevronDown size={14} className="text-gray-400" />
          </button>
          
          {showVoiceSelector && (
            <div 
              ref={voiceMenuRef}
              className="absolute top-full left-0 mt-1 w-48 bg-gray-800 shadow-lg rounded-md border border-gray-700 py-1 z-10 voice-menu custom-scrollbar"
            >
              <div className="max-h-48 overflow-y-auto">
                {ELEVENLABS_VOICES.map((voice) => (
                  <button
                    key={voice.id}
                    className={`flex items-center justify-between w-full px-4 py-2 text-sm text-left voice-menu-item ${
                      selectedVoice.id === voice.id ? 'bg-blue-900/40 text-blue-300 active' : 'text-gray-300 hover:bg-gray-700'
                    }`}
                    onClick={() => selectVoice(voice)}
                  >
                    <span>{voice.name}</span>
                    {selectedVoice.id === voice.id && <Check size={14} className="text-blue-400" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Play/Stop button */}
        <button
          className={`tts-button p-2 rounded-full flex items-center justify-center text-white ${
            isPlaying ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
          } ${isPlaying ? 'playing' : ''}`}
          onClick={isPlaying ? stopPlayback : playTextToSpeech}
          disabled={isLoading}
          title={isPlaying ? "Stop" : "Play with ElevenLabs"}
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : isPlaying ? (
            <VolumeX size={18} />
          ) : (
            <Volume2 size={18} />
          )}
        </button>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-red-900/80 text-white text-xs rounded text-center max-w-xs mx-auto">
          {error}
        </div>
      )}
    </div>
  );
}