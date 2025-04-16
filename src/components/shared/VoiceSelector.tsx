// src/components/shared/VoiceSelector.tsx
"use client";

import React, { useState } from "react";
import { Check, ChevronDown, Headphones } from "lucide-react";

interface VoiceSelectorProps {
  selectedVoice: string;
  onVoiceChange: (voiceId: string) => void;
  className?: string;
}

// Voice options - you can expand this list with actual ElevenLabs voices
const VOICE_OPTIONS = [
  { id: "default", name: "Rachel (Default)", gender: "female" },
  { id: "male", name: "Adam", gender: "male" },
  { id: "female", name: "Rachel", gender: "female" },
  // Add more voices as needed
];

export default function VoiceSelector({ 
  selectedVoice, 
  onVoiceChange, 
  className = ""
}: VoiceSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Find the selected voice details
  const selectedVoiceDetails = VOICE_OPTIONS.find(v => v.id === selectedVoice) || VOICE_OPTIONS[0];

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <Headphones size={16} className="text-blue-500" />
        <span>{selectedVoiceDetails.name}</span>
        <ChevronDown size={16} className="text-gray-500" />
      </button>
      
      {isOpen && (
        <>
          {/* Backdrop to close menu when clicking outside */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown menu */}
          <div className="absolute z-50 mt-1 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 py-1">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
              Select Voice
            </div>
            <ul 
              className="max-h-48 overflow-auto"
              role="listbox"
              aria-activedescendant={selectedVoice}
            >
              {VOICE_OPTIONS.map((voice) => (
                <li 
                  key={voice.id}
                  id={voice.id}
                  role="option"
                  aria-selected={voice.id === selectedVoice}
                  className={`
                    px-3 py-2 flex items-center justify-between cursor-pointer
                    ${voice.id === selectedVoice ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}
                  `}
                  onClick={() => {
                    onVoiceChange(voice.id);
                    setIsOpen(false);
                  }}
                >
                  <div>
                    <div className="text-sm font-medium">{voice.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {voice.gender === 'male' ? 'Male' : 'Female'} Voice
                    </div>
                  </div>
                  
                  {voice.id === selectedVoice && (
                    <Check size={16} className="text-blue-500" />
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}