// src/components/modes/CombinedMode.tsx

import React, { useState, useRef, useEffect } from "react";
import { Send, Mic, Square, Bot, User } from "lucide-react";
import MessageDisplay, { Message } from '@/components/shared/MessageDisplay';
import useAudioRecorder from '@/hooks/useAudioRecorder';
import { processText, transcribeAudio } from '@/services/aiService';
import logger from '@/utils/logger';

interface CombinedModeProps {
  activeMicId: string;
}

export default function CombinedMode({ activeMicId }: CombinedModeProps) {
  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");
  const [pulseSize, setPulseSize] = useState(0);
  
  // Refs
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  // Use audio recorder hook
  const {
    isRecording,
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
      "Welcome to Combined Mode. You can type your message or use the microphone to speak.",
      "assistant"
    );
  }, []);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "24px";
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  // Pulse animation for recording
  useEffect(() => {
    if (isRecording) {
      const interval = setInterval(() => {
        setPulseSize((prev) => (prev < 3 ? prev + 1 : 0));
      }, 400);
      return () => {
        clearInterval(interval);
        setPulseSize(0);
      };
    }
  }, [isRecording]);

  // Function to add a message to the chat
  function addMessage(content: string, type: "user" | "assistant" | "system") {
    const timestamp = new Date().toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit'
    });
    
    setMessages((prev) => [
      ...prev,
      { content, type, timestamp }
    ]);
  }

  // Handle form submission
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (inputValue.trim() && !isProcessing && !isRecording) {
      processUserInput(inputValue.trim());
      setInputValue("");
    }
  }

  // Process text input
  async function processUserInput(text: string) {
    try {
      setIsProcessing(true);
      setProcessingStatus("Processing with AI...");
      
      // Display user message
      addMessage(text, "user");
      
      // Process with AI service
      const result = await processText(text);
      
      // Display assistant response
      addMessage(result.response, "assistant");
    } catch (error) {
      logger.error("chat", "Error in text processing:", error);
      addMessage(`Sorry, I encountered an error: ${(error as Error).message}`, "assistant");
    } finally {
      setProcessingStatus("");
      setIsProcessing(false);
    }
  }

  // Handle captured audio
  async function handleAudioCaptured(audioBlob: Blob) {
    try {
      setIsProcessing(true);
      setProcessingStatus("Transcribing audio...");
      
      // Transcribe using the audioService
      const transcriptionResult = await transcribeAudio(audioBlob);
      const userText = transcriptionResult.text;
      
      if (userText && userText.trim()) {
        // Display user message
        addMessage(userText, "user");
        
        // Process with AI service
        setProcessingStatus("Processing with AI...");
        
        const result = await processText(userText);
        
        // Display assistant response
        addMessage(result.response, "assistant");
      } else {
        addMessage("I couldn't understand what you said. Please try again.", "assistant");
      }
    } catch (error) {
      logger.error("chat", "Error in audio processing:", error);
      addMessage(`Sorry, I encountered an error: ${(error as Error).message}`, "assistant");
    } finally {
      setProcessingStatus("");
      setIsProcessing(false);
    }
  }

  // Render pulse circles for recording animation
  function renderPulseCircles() {
    return Array.from({ length: 4 }).map((_, i) => (
      <div
        key={i}
        className={`
          absolute rounded-full bg-teal-500 
          transition-all duration-500 ease-in-out
        `}
        style={{
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          transform: `scale(${i < pulseSize ? 1 + i * 0.2 : 1})`,
          opacity: i < pulseSize ? (4 - i) * 0.2 : 0,
        }}
      />
    ));
  }

  // Render assistant and user icons
  const assistantIcon = (
    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-teal-400 to-emerald-500 flex items-center justify-center shadow-md">
      <Bot size={16} className="text-white" />
    </div>
  );
  
  const userIcon = (
    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 flex items-center justify-center shadow-md">
      <User size={16} className="text-white" />
    </div>
  );

  return (
    <div className="flex flex-col h-screen max-h-[75vh] md:h-[75vh] w-full max-w-2xl mx-auto rounded-xl overflow-hidden shadow-xl bg-white dark:bg-gray-900">
      {/* Messages Display using shared component */}
      <MessageDisplay
        messages={messages}
        isProcessing={isProcessing}
        processingText={processingStatus || "Processing..."}
        emptyStateMessage="Start a conversation by typing or speaking"
        userIcon={userIcon}
        assistantIcon={assistantIcon}
        colors={{
          user: 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white',
          assistant: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-teal-100 dark:border-gray-700 shadow-md',
          system: 'bg-gray-100 dark:bg-gray-900 text-gray-500 italic text-sm'
        }}
      />

      {/* Input Area */}
      <div className="p-4 bg-white dark:bg-gray-800 border-t border-teal-100 dark:border-gray-700">
        <form onSubmit={handleSubmit} className="flex items-end space-x-2">
          <div className="relative flex-1 border border-teal-300 dark:border-gray-600 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-teal-400 dark:focus-within:ring-emerald-500 focus-within:border-transparent">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Message Assistant..."
              className="w-full max-h-40 resize-none pl-4 pr-12 py-3 bg-transparent focus:outline-none"
              rows={1}
              disabled={isProcessing || isRecording}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            
            <div className="absolute right-2 bottom-2">
              <button
                type="button"
                className={`
                  relative w-8 h-8 rounded-full flex items-center justify-center 
                  transition-colors focus:outline-none
                  ${isRecording
                    ? 'bg-red-500 text-white'
                    : isProcessing || (inputValue.trim() !== '')
                      ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                      : 'bg-teal-100 text-teal-600 hover:bg-teal-200 dark:bg-gray-700 dark:text-teal-400 dark:hover:bg-gray-600'
                  }
                `}
                onClick={toggleRecording}
                disabled={isProcessing || (inputValue.trim() !== '' && !isRecording)}
                title={isRecording ? "Stop recording" : "Start voice input"}
                aria-label={isRecording ? "Stop recording" : "Start voice input"}
              >
                {isRecording ? (
                  <>
                    <Square size={14} className="relative z-10" />
                    {renderPulseCircles()}
                  </>
                ) : (
                  <Mic size={14} />
                )}
              </button>
            </div>
          </div>
          
          <button
            type="submit"
            className={`
              p-3 rounded-xl focus:outline-none transition-colors shadow-md
              ${isProcessing || isRecording || inputValue.trim() === ''
                ? 'bg-teal-300 dark:bg-gray-700 cursor-not-allowed'
                : 'bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700'}
              text-white
            `}
            disabled={isProcessing || isRecording || inputValue.trim() === ''}
            title="Send message"
            aria-label="Send message"
          >
            <Send size={18} />
          </button>
        </form>
        
        {(processingStatus && (isRecording || isProcessing)) && (
          <div className="mt-2 text-center text-sm text-teal-600 dark:text-teal-400 font-medium">
            {processingStatus}
          </div>
        )}
      </div>
    </div>
  );
}