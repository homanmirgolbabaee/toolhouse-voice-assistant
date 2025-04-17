// src/contexts/TTSContext.tsx
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Voice, ELEVENLABS_VOICES } from '@/utils/elevenLabsTTS';
import logger from '@/utils/logger';

interface TTSContextType {
  apiKey: string;
  setApiKey: (key: string) => void;
  selectedVoice: Voice;
  setSelectedVoice: (voice: Voice) => void;
  isTTSEnabled: boolean;
  setIsTTSEnabled: (enabled: boolean) => void;
  voices: Voice[];
  isReady: boolean;
  hasValidKey: boolean;
}

const TTSContext = createContext<TTSContextType>({
  apiKey: '',
  setApiKey: () => {},
  selectedVoice: ELEVENLABS_VOICES[0],
  setSelectedVoice: () => {},
  isTTSEnabled: true,
  setIsTTSEnabled: () => {},
  voices: ELEVENLABS_VOICES,
  isReady: false,
  hasValidKey: false
});

export const useTTS = () => useContext(TTSContext);

interface TTSProviderProps {
  children: ReactNode;
}

export function TTSProvider({ children }: TTSProviderProps) {
  const [apiKey, setApiKey] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<Voice>(ELEVENLABS_VOICES[0]);
  const [isTTSEnabled, setIsTTSEnabled] = useState(true);
  const [voices, setVoices] = useState<Voice[]>(ELEVENLABS_VOICES);
  const [isReady, setIsReady] = useState(false);
  const [hasValidKey, setHasValidKey] = useState(false);
  
  // Function to safely store API key
  const storeApiKey = (key: string) => {
    try {
      if (key) {
        localStorage.setItem('elevenlabs_api_key', key);
        setHasValidKey(true);
        logger.debug('tts', 'API key stored successfully');
      } else {
        localStorage.removeItem('elevenlabs_api_key');
        setHasValidKey(false);
        logger.debug('tts', 'API key removed');
      }
    } catch (error) {
      logger.error('tts', 'Error storing API key', error);
    }
  };
  
  // Handle API key changes
  useEffect(() => {
    if (apiKey) {
      storeApiKey(apiKey);
    }
  }, [apiKey]);
  
  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      // Load API key
      const savedApiKey = localStorage.getItem('elevenlabs_api_key');
      if (savedApiKey) {
        setApiKey(savedApiKey);
        setHasValidKey(true);
        logger.debug('tts', 'Loaded API key from localStorage');
      }
      
      // Load selected voice
      const savedVoiceId = localStorage.getItem('elevenlabs_selected_voice');
      if (savedVoiceId) {
        const voice = ELEVENLABS_VOICES.find(v => v.id === savedVoiceId);
        if (voice) {
          setSelectedVoice(voice);
          logger.debug('tts', `Loaded voice selection: ${voice.name}`);
        }
      }
      
      // Load TTS enabled state
      const ttsEnabledStr = localStorage.getItem('elevenlabs_tts_enabled');
      if (ttsEnabledStr !== null) {
        const enabled = ttsEnabledStr === 'true';
        setIsTTSEnabled(enabled);
        logger.debug('tts', `TTS enabled: ${enabled}`);
      }
      
      // Mark context as ready
      setIsReady(true);
    } catch (error) {
      logger.error('tts', 'Error loading TTS settings', error);
      setIsReady(true); // Still mark as ready to avoid blocking the app
    }
  }, []);
  
  // Save voice and enabled state to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('elevenlabs_selected_voice', selectedVoice.id);
      localStorage.setItem('elevenlabs_tts_enabled', String(isTTSEnabled));
    } catch (error) {
      logger.error('tts', 'Error saving TTS settings', error);
    }
  }, [selectedVoice, isTTSEnabled]);
  
  const value = {
    apiKey,
    setApiKey,
    selectedVoice,
    setSelectedVoice,
    isTTSEnabled,
    setIsTTSEnabled,
    voices,
    isReady,
    hasValidKey
  };
  
  return (
    <TTSContext.Provider value={value}>
      {children}
    </TTSContext.Provider>
  );
}

export default TTSContext;