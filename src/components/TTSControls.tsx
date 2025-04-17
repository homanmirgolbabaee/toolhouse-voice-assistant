// src/components/TTSControls.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Headphones, Settings, ChevronDown, Check, Volume2, X, Key } from 'lucide-react';
import { useTTS } from '@/contexts/TTSContext';
import { Voice, generateSpeech, playAudio } from '@/utils/elevenLabsTTS';
import ApiKeySetup from './ApiKeySetup';
import logger from '@/utils/logger';

interface TTSControlsProps {
  className?: string;
  position?: 'inline' | 'dropdown';
}

export default function TTSControls({ className = "", position = 'dropdown' }: TTSControlsProps) {
  const { 
    apiKey, 
    selectedVoice, 
    setSelectedVoice, 
    isTTSEnabled, 
    setIsTTSEnabled,
    voices,
    hasValidKey
  } = useTTS();
  
  const [isOpen, setIsOpen] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [testingVoice, setTestingVoice] = useState<string | null>(null);
  
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
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

  if (position === 'inline') {
    // Render inline controls without dropdown
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        {hasValidKey ? (
          <>
            <div className="flex items-center gap-1 px-2 py-1 bg-gray-800/40 rounded-md text-gray-300">
              <Headphones size={14} className="text-blue-400" />
              <span className="text-sm font-medium">{selectedVoice.name}</span>
            </div>
            <button
              onClick={() => setShowApiKeyModal(true)}
              className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-gray-800/40"
              title="API Key Settings"
            >
              <Settings size={14} />
            </button>
          </>
        ) : (
          <button
            onClick={() => setShowApiKeyModal(true)}
            className="flex items-center gap-1 px-2 py-1 bg-blue-900/30 text-blue-400 rounded-md hover:bg-blue-900/50 transition-colors"
          >
            <Key size={14} />
            <span className="text-sm">Set API Key</span>
          </button>
        )}
        
        {showApiKeyModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
            <ApiKeySetup onClose={() => setShowApiKeyModal(false)} />
          </div>
        )}
      </div>
    );
  }

  // Default dropdown view
  return (
    <div className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-3 py-1.5 bg-gray-800/50 hover:bg-gray-800 rounded-md transition-colors"
        title="Text-to-Speech Settings"
      >
        <Headphones size={16} className={hasValidKey ? "text-blue-400" : "text-gray-400"} />
        <span className="text-sm text-gray-300">
          {hasValidKey ? selectedVoice.name : "TTS Settings"}
        </span>
        <ChevronDown size={14} className="text-gray-500" />
      </button>
      
      {/* Dropdown menu */}
      {isOpen && (
        <div 
          ref={menuRef}
          className="absolute right-0 top-full mt-1 w-64 bg-gray-900 rounded-md shadow-xl border border-gray-800 overflow-hidden z-10"
        >
          <div className="p-3 border-b border-gray-800 flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-200">Text-to-Speech</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-200"
            >
              <X size={16} />
            </button>
          </div>
          
          <div className="p-3">
            {/* TTS Enable/Disable Toggle */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-300">Enable TTS</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={isTTSEnabled} 
                  onChange={() => setIsTTSEnabled(!isTTSEnabled)} 
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            {/* API Key Status/Button */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-gray-300">API Key</span>
                {hasValidKey ? (
                  <span className="text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full">
                    Configured
                  </span>
                ) : (
                  <span className="text-xs text-red-400 bg-red-900/30 px-2 py-0.5 rounded-full">
                    Not Set
                  </span>
                )}
              </div>
              <button
                onClick={() => {
                  setShowApiKeyModal(true);
                  setIsOpen(false);
                }}
                className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-md transition-colors"
              >
                {hasValidKey ? 'Update API Key' : 'Set API Key'}
              </button>
            </div>
            
            {/* Voice Selection - only if API key is configured */}
            {hasValidKey && (
              <div>
                <label className="block text-sm text-gray-300 mb-1">Voice</label>
                <div className="space-y-1 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                  {voices.map(voice => (
                    <div 
                      key={voice.id}
                      className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer ${
                        selectedVoice.id === voice.id 
                          ? 'bg-blue-900/40 text-blue-300' 
                          : 'hover:bg-gray-800 text-gray-300'
                      }`}
                      onClick={() => setSelectedVoice(voice)}
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
          
          {/* Footer with credits */}
          <div className="p-2 bg-gray-950 border-t border-gray-800">
            <p className="text-xs text-gray-500 text-center">
              Powered by <a 
                href="https://elevenlabs.io" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                ElevenLabs
              </a>
            </p>
          </div>
        </div>
      )}
      
      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <ApiKeySetup onClose={() => setShowApiKeyModal(false)} />
        </div>
      )}
    </div>
  );
}