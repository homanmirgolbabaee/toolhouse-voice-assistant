// src/components/shared/MessageDisplay.tsx
import React, { useRef, useEffect } from 'react';
import MessageFormatter from '../MessageFormatter'; 


export interface Message {
  content: string;
  type: 'user' | 'assistant' | 'system';
  timestamp: string;
}

interface MessageDisplayProps {
  messages: Message[];
  isProcessing?: boolean;
  processingText?: string;
  emptyStateMessage?: string;
  userIcon?: React.ReactNode;
  assistantIcon?: React.ReactNode;
  colors?: {
    user?: string;
    assistant?: string;
    system?: string;
  };
  onSaveMessage?: (message: Message) => void;
}

export default function MessageDisplay({
  messages,
  isProcessing = false,
  processingText = "Processing...",
  emptyStateMessage = "Start a conversation by typing a message or using voice input",
  userIcon,
  assistantIcon,
  colors = {
    user: 'bg-blue-600 text-white',
    assistant: 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700',
    system: 'bg-gray-100 dark:bg-gray-900 text-gray-500 italic text-sm'
  },
  onSaveMessage
}: MessageDisplayProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);


  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  return (
    <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-gray-800">
      {messages.length === 0 ? (
        <div className="h-full flex items-center justify-center text-gray-400">
          <p>{emptyStateMessage}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {messages.map((message, index) => (
            <div 
              key={index} 
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.type === 'assistant' && assistantIcon && (
                <div className="mr-2">
                  {assistantIcon}
                </div>
              )}
              
              <div className={`relative max-w-[80%] rounded-lg px-4 py-3 group ${colors[message.type] || ''}`}>
              {message.type === 'assistant' ? (

                  <div className="relative">
                    <MessageFormatter content={message.content} />
                    
                    {/* TTS button for assistant messages */}

                  </div>

              ) : (
                <p className="whitespace-pre-wrap">{message.content}</p>
            )}
                
                {message.type === 'assistant' && onSaveMessage && (
                  <div className="absolute right-0 top-0 -mt-2 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onSaveMessage(message)}
                      className="bg-blue-600 text-white rounded-full p-1 shadow-md hover:bg-blue-700"
                      title="Save to note"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                        <polyline points="17 21 17 13 7 13 7 21"></polyline>
                        <polyline points="7 3 7 8 15 8"></polyline>
                      </svg>
                    </button>
                  </div>
                )}
              </div>
              
              {message.type === 'user' && userIcon && (
                <div className="ml-2">
                  {userIcon}
                </div>
              )}
            </div>
          ))}
          
          {isProcessing && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg px-4 py-3 bg-gray-200 dark:bg-gray-700">
                <div className="flex items-center space-x-2">
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    {processingText}
                  </div>
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse delay-100"></div>
                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse delay-200"></div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
}