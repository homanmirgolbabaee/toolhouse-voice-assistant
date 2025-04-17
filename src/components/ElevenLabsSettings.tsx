// src/components/ElevenLabsSettings.tsx
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Headphones, Check, X, Volume2, Settings } from 'lucide-react';
import { useTTS } from '@/contexts/TTSContext';
import { Voice, ELEVENLABS_VOICES, generateSpeech, playAudio } from '@/utils/elevenLabsTTS';
import logger from '@/utils/logger';

interface ElevenLabsSettingsProps {
  className?: string;
}

export default function ElevenLabsSettings({ className = "" }: ElevenLabsSettingsProps) {
  const { 
    apiKey, 
    setApiKey, 
    selectedVoice, 
    setSelectedVoice, 
    isTTSEnabled, 
    setIsTTSEnabled,
    voices 
  } = useTTS();
  
  const [isOpen, setIsOpen] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [localApiKey, setLocalApiKey] = useState(apiKey);
  const [testingVoice, setTestingVoice] = useState<string | null>(null);
  
  const menuRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
      
      if (modalRef.current && !modalRef.current.contains(event.target as Node) && 
          event.target instanceof Element && !event.target.closest('[data-modal-backdrop]')) {
        setShowApiKeyModal(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleApiKeySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setApiKey(localApiKey);
    setShowApiKeyModal(false);
  };
  
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
      {/* Trigger Button - improved version */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
        title="ElevenLabs TTS Settings"
      >
        <Headphones size={16} />
        <span className="text-sm hidden sm:inline-block">{selectedVoice.name}</span>
      </button>

      {/* Settings Menu - Dark theme version */}
      {isOpen && (
        <div 
          ref={menuRef}
          className="absolute right-0 bottom-full mb-2 w-64 bg-gray-900 rounded-lg shadow-xl border border-gray-800 z-50 overflow-hidden"
        >
          <div className="p-3 border-b border-gray-800 flex justify-between items-center">
            <h3 className="font-medium text-sm text-gray-200">ElevenLabs TTS</h3>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-200"
            >
              <X size={16} />
            </button>
          </div>

          <div className="p-3">
            {/* TTS On/Off Toggle */}
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
            
            {/* Voice Selection */}
            <div className="mb-4">
              <label className="block text-sm text-gray-300 mb-1">Voice</label>
              <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                {ELEVENLABS_VOICES.map(voice => (
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
            
            {/* API Key Button */}
            <button
              onClick={() => setShowApiKeyModal(true)}
              className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-md transition-colors"
            >
              {apiKey ? 'Update API Key' : 'Set API Key'}
            </button>
          </div>
        </div>
      )}

      {/* API Key Modal - Dark theme version */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" data-modal-backdrop>
          <div 
            ref={modalRef}
            className="bg-gray-900 rounded-lg shadow-xl border border-gray-800 w-96 p-4 mx-4"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-200">ElevenLabs API Key</h3>
              <button 
                onClick={() => setShowApiKeyModal(false)}
                className="text-gray-400 hover:text-gray-200"
              >
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleApiKeySubmit}>
              <div className="mb-4">
                <label className="block text-sm text-gray-300 mb-1">API Key</label>
                <input
                  type="password"
                  value={localApiKey}
                  onChange={(e) => setLocalApiKey(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md text-sm text-gray-200"
                  placeholder="Enter your ElevenLabs API key"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Get your API key from{' '}
                  <a 
                    href="https://elevenlabs.io/app/api-key" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    ElevenLabs
                  </a>
                </p>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowApiKeyModal(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-md transition-colors"
                >
                  Save Key
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}