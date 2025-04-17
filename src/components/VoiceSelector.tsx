// src/components/VoiceSelector.tsx
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Volume2 } from 'lucide-react';
import { useTTS } from '@/contexts/TTSContext';
import { Voice, generateSpeech, playAudio } from '@/utils/elevenLabsTTS';
import logger from '@/utils/logger';

interface VoiceSelectorProps {
  minimal?: boolean;
  className?: string;
  buttonClassName?: string;
  dropdownPosition?: 'top' | 'bottom';
}

export default function VoiceSelector({ 
  minimal = false,
  className = "",
  buttonClassName = "",
  dropdownPosition = 'bottom'
}: VoiceSelectorProps) {
  const { apiKey, selectedVoice, setSelectedVoice, voices } = useTTS();
  
  const [isOpen, setIsOpen] = useState(false);
  const [testingVoice, setTestingVoice] = useState<string | null>(null);
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);
  
  // Test a voice by speaking a sample phrase
  const testVoice = async (voice: Voice) => {
    if (!apiKey || testingVoice === voice.id) return;
    
    try {
      setTestingVoice(voice.id);
      
      // Generate a short test speech
      const audioBlob = await generateSpeech({
        text: "This is a sample of my voice.",
        voiceId: voice.id,
        apiKey
      });
      
      // Play the audio
      const audio = playAudio(audioBlob);
      
      // Clear testing state when done
      audio.onended = () => setTestingVoice(null);
      audio.onerror = () => {
        logger.error('audio', 'Error playing voice test');
        setTestingVoice(null);
      };
    } catch (error) {
      logger.error('audio', 'Error testing voice', error);
      setTestingVoice(null);
    }
  };
  
  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={!apiKey}
        className={`flex items-center gap-1 ${
          minimal
            ? 'text-gray-300 hover:text-gray-100'
            : 'px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-md text-gray-300'
        } ${buttonClassName}`}
      >
        {minimal ? (
          selectedVoice.name
        ) : (
          <>
            <span className="text-sm">Voice: {selectedVoice.name}</span>
            <ChevronDown size={14} className="text-gray-400" />
          </>
        )}
      </button>
      
      {isOpen && (
        <div 
          ref={dropdownRef}
          className={`absolute ${
            dropdownPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
          } left-0 w-48 bg-gray-900 rounded-md border border-gray-800 shadow-lg z-10 p-1`}
        >
          <div className="max-h-52 overflow-y-auto pr-1">
            {voices.map(voice => (
              <div 
                key={voice.id}
                className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer ${
                  selectedVoice.id === voice.id 
                    ? 'bg-blue-900/40 text-blue-300' 
                    : 'hover:bg-gray-800 text-gray-300'
                }`}
                onClick={() => {
                  setSelectedVoice(voice);
                  setIsOpen(false);
                }}
              >
                <div className="flex items-center">
                  {selectedVoice.id === voice.id && (
                    <Check size={14} className="mr-2 text-blue-400" />
                  )}
                  <span className="text-sm">{voice.name}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    testVoice(voice);
                  }}
                  className={`text-gray-400 hover:text-blue-400 ${testingVoice === voice.id ? 'text-blue-400 animate-pulse' : ''}`}
                  title="Preview voice"
                  disabled={testingVoice !== null}
                >
                  <Volume2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}