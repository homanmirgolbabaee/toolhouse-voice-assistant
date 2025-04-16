// src/components/modes/VoiceMode.tsx

import React, { useState, useEffect } from 'react';
import { Volume2, User } from 'lucide-react';
import useAudioRecorder from '@/hooks/useAudioRecorder';
import MessageDisplay, { Message } from '@/components/shared/MessageDisplay';
import { transcribeAudio, processText } from '@/services/aiService';
import logger from '@/utils/logger';

interface VoiceModeProps {
  activeMicId: string;
}

export default function VoiceMode({ activeMicId }: VoiceModeProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState("");
  
  // Use the shared audio recorder hook
  const {
    isRecording,
    isProcessing,
    audioLevel,
    startRecording,
    stopRecording,
    toggleRecording
  } = useAudioRecorder({
    deviceId: activeMicId,
    onAudioCaptured: handleAudioCaptured
  });

  // Add initial greeting message
  useEffect(() => {
    addMessage(
      "Welcome to Voice Mode. Tap the microphone and speak clearly. The microphone will pulse as you speak.",
      "assistant"
    );
  }, []);

  // Function to add a message to the chat
  function addMessage(content: string, type: 'user' | 'assistant' | 'system') {
    const timestamp = new Date().toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    setMessages(prev => [...prev, { content, type, timestamp }]);
  }

  // Handle captured audio
  async function handleAudioCaptured(audioBlob: Blob) {
    setStatus("Processing your voice...");
    
    try {
      // Step 1: Transcribe audio
      const { text } = await transcribeAudio(audioBlob);
      
      if (!text || text.trim() === "") {
        throw new Error("I couldn't hear anything. Please speak more clearly.");
      }
      
      logger.debug('voice', 'Audio transcribed', { textLength: text.length });
      addMessage(text, "user");
      
      // Step 2: Process with AI
      setStatus("Getting your answer...");
      
      const { response } = await processText(text);
      addMessage(response, "assistant");
      
    } catch (error) {
      logger.error('voice', 'Voice processing error', error);
      addMessage(`${(error as Error).message}`, "assistant");
    }
  }

  // Render assistant and user icons
  const assistantIcon = (
    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center shadow-md">
      <Volume2 size={16} className="text-white" />
    </div>
  );
  
  const userIcon = (
    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 flex items-center justify-center shadow-md">
      <User size={16} className="text-white" />
    </div>
  );

  return (
    <div className="flex flex-col h-screen max-h-[75vh] md:h-[75vh] w-full max-w-2xl mx-auto rounded-xl overflow-hidden shadow-xl bg-white dark:bg-gray-900">
      {/* Messages Display using shared component */}
      <MessageDisplay
        messages={messages}
        isProcessing={isProcessing}
        processingText={status || "Processing..."}
        userIcon={userIcon}
        assistantIcon={assistantIcon}
        colors={{
          user: 'bg-gradient-to-r from-blue-500 to-blue-600 text-white',
          assistant: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-blue-100 dark:border-gray-700 shadow-md',
          system: 'bg-gray-100 dark:bg-gray-900 text-gray-500 italic text-sm'
        }}
      />

      {/* Voice Control */}
      <div className="p-6 flex items-center justify-center bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="relative flex flex-col items-center">
          <div className="relative w-16 h-16">
            {/* Audio level indicator rings */}
            {isRecording && (
              <>
                <div 
                  className="absolute inset-0 rounded-full border-4 border-blue-400/70 pointer-events-none"
                  style={{
                    transform: `scale(${1 + audioLevel * 0.5})`,
                    opacity: 0.7 - audioLevel * 0.3,
                    transition: "all 0.2s ease-out"
                  }}
                />
                <div 
                  className="absolute inset-0 rounded-full border-2 border-blue-300/50 pointer-events-none"
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
              disabled={isProcessing && !isRecording}
              className="absolute inset-0 rounded-full flex items-center justify-center transition-all duration-100 focus:outline-none text-white shadow-lg"
              style={{
                backgroundColor: isRecording ? "rgb(239, 68, 68)" : "rgb(59, 130, 246)",
                transform: isRecording ? `scale(${1 + audioLevel * 0.3})` : "scale(1)",
                transition: "transform 0.1s ease-out, background-color 0.1s ease-out"
              }}
              aria-label={isRecording ? "Stop recording" : "Start recording"}
            >
              {isRecording ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="6" y="6" width="12" height="12"></rect>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                  <line x1="12" x2="12" y1="19" y2="22"></line>
                </svg>
              )}
            </button>
          </div>
          
          <div className="mt-2 text-sm font-medium">
            {isRecording ? "Tap to stop" : "Tap to record"}
          </div>
        </div>
      </div>
    </div>
  );
}