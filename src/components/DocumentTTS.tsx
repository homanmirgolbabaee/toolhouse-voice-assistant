// src/components/DocumentTTS.tsx
"use client";

import React, { useState } from 'react';
import { Volume2, VolumeX, Loader2 } from 'lucide-react';
import { useTTS } from '@/contexts/TTSContext';
import { generateSpeech, playAudio } from '@/utils/elevenLabsTTS';
import { Document } from '@/models/document';
import logger from '@/utils/logger';

interface DocumentTTSProps {
  document: Document;
  className?: string;
}

export default function DocumentTTS({ document, className = "" }: DocumentTTSProps) {
  const { apiKey, selectedVoice, isTTSEnabled } = useTTS();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentBlockIndex, setCurrentBlockIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Don't render if TTS is disabled or no API key
  if (!isTTSEnabled || !apiKey) {
    return null;
  }

  // Extract plain text from document blocks with character limit
  const extractText = (): string => {
    const MAX_CHARS = 5000; // ElevenLabs free tier limit to be safe
    let text = document.title + ".\n\n";
    let charCount = text.length;
    
    for (const block of document.blocks) {
      // Check if adding this block would exceed character limit
      const blockText = getBlockText(block);
      if (charCount + blockText.length > MAX_CHARS) {
        // Add a note about truncation and break
        text += "\n\n[Text truncated due to length limits]";
        break;
      }
      
      text += blockText;
      charCount += blockText.length;
    }
    
    return text;
  };

  // Get text from a block based on its type
  const getBlockText = (block: any): string => {
    switch (block.type) {
      case 'heading':
        return block.content + ".\n\n";
      case 'text':
        return block.content + "\n\n";
      case 'list':
        return "• " + block.content + "\n";
      case 'todo':
        return (block.properties?.checked ? "Completed task: " : "Task: ") + block.content + "\n";
      case 'code':
        return "Code block: " + block.content + "\n\n";
      default:
        if (block.content) {
          return block.content + "\n\n";
        }
        return "";
    }
  };

  // Handle reading the document
  const handleReadDocument = async () => {
    if (isPlaying || isLoading) {
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Extract document text
      const text = extractText();
      
      if (!text.trim()) {
        setError("Document is empty");
        setIsLoading(false);
        return;
      }
      
      // Check length to avoid API errors
      if (text.length > 5000) {
        logger.warn('tts', 'Document text too long, truncating', { length: text.length });
      }
      
      // Generate speech
      const audioBlob = await generateSpeech({
        text,
        voiceId: selectedVoice.id,
        apiKey
      });
      
      // Play the audio
      const audio = playAudio(audioBlob);
      
      // Set states
      setIsPlaying(true);
      setIsLoading(false);
      
      // Handle audio events
      audio.onended = () => {
        setIsPlaying(false);
        setCurrentBlockIndex(null);
      };
      
      audio.onpause = () => {
        setIsPlaying(false);
        setCurrentBlockIndex(null);
      };
      
      audio.onerror = (e) => {
        logger.error('audio', 'Error playing document TTS', e);
        setIsPlaying(false);
        setIsLoading(false);
        setCurrentBlockIndex(null);
        setError("Error playing audio");
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('audio', 'Error generating document speech', error);
      setIsLoading(false);
      setError(errorMessage);
    }
  };

  return (
    <>
      <button
        onClick={handleReadDocument}
        disabled={isLoading}
        className={`p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 ${
          isPlaying ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : ''
        } ${className}`}
        title={isPlaying ? "Stop reading" : "Read document with ElevenLabs"}
      >
        {isLoading ? (
          <Loader2 size={20} className="animate-spin" />
        ) : isPlaying ? (
          <VolumeX size={20} />
        ) : (
          <Volume2 size={20} />
        )}
      </button>
      
      {/* Error message toast */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-900/80 text-white px-4 py-2 rounded-lg shadow-lg z-50 max-w-md">
          <div className="font-medium">TTS Error</div>
          <div className="text-sm">{error}</div>
        </div>
      )}
    </>
  );
}