// src/components/ApiKeySetup.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, ExternalLink } from 'lucide-react';
import { useTTS } from '@/contexts/TTSContext';
import logger from '@/utils/logger';

interface ApiKeySetupProps {
  onClose: () => void;
  className?: string;
}

export default function ApiKeySetup({ onClose, className = "" }: ApiKeySetupProps) {
  const { apiKey, setApiKey } = useTTS();
  const [localApiKey, setLocalApiKey] = useState(apiKey || '');
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // If apiKey from context changes, update local state
  useEffect(() => {
    setLocalApiKey(apiKey || '');
  }, [apiKey]);

  // Simple validation
  const validateApiKey = (key: string): boolean => {
    // ElevenLabs API keys are typically 32 characters
    return key.length >= 30;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!localApiKey.trim()) {
      setError("API key is required");
      return;
    }
    
    if (!validateApiKey(localApiKey)) {
      setError("API key appears to be invalid. ElevenLabs API keys are typically long strings of characters.");
      return;
    }
    
    try {
      setValidating(true);
      logger.debug('tts', 'Saving API key');
      
      // Set the API key in context (which will also store it in localStorage)
      setApiKey(localApiKey);
      
      // Show success state briefly
      setSaved(true);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      setError("There was an error saving your API key. Please try again.");
      logger.error("tts", "Error saving API key:", error);
    } finally {
      setValidating(false);
    }
  };
  
  return (
    <div className={`bg-gray-900 rounded-lg shadow-2xl border border-gray-800 max-w-md w-full p-6 ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-100">ElevenLabs API Key</h2>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-gray-200 transition-colors"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>
      
      <p className="text-gray-300 mb-4">
        To use Text-to-Speech features, you need an ElevenLabs API key. Your key is stored securely in your browser and is not sent to our servers.
      </p>
      
      {saved ? (
        <div className="flex items-center gap-2 p-3 bg-green-900/30 border border-green-800 rounded-md text-green-400 mb-4">
          <Check size={20} />
          <span>API key saved successfully!</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-900/30 border border-red-800 rounded-md text-red-400 mb-4">
              <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          
          <div className="mb-4">
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-300 mb-1">
              API Key
            </label>
            <input
              id="apiKey"
              type="password"
              value={localApiKey}
              onChange={(e) => setLocalApiKey(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-800 rounded-md text-gray-200"
              placeholder="Enter your ElevenLabs API key"
              disabled={validating}
            />
            <p className="mt-1 text-sm text-gray-400 flex items-center">
              Get your API key from{' '}
              <a 
                href="https://elevenlabs.io/app/api-keys" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline ml-1 flex items-center"
              >
                ElevenLabs API Key Page <ExternalLink size={12} className="ml-1" />
              </a>
            </p>
          </div>
          
          <div className="flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md transition-colors"
              disabled={validating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors flex items-center justify-center min-w-[80px]"
              disabled={validating}
            >
              {validating ? (
                <div className="w-5 h-5 border-2 border-gray-300 border-t-white rounded-full animate-spin"></div>
              ) : (
                'Save'
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}