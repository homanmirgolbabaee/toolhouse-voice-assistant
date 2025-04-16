// src/components/modes/ChatMode.tsx

import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User } from "lucide-react";
import { processText } from '@/services/aiService';
import logger from '@/utils/logger';
import ErrorBoundary from "@/components/ErrorBoundary";

// Define the Message interface
interface Message {
  content: string;
  role: string;
  timestamp: string;
}

export default function ChatMode() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Add initial greeting message
  useEffect(() => {
    addMessage(
      "Welcome to Chat Mode. Type your message and press Enter or click the Send button.",
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

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Function to add a message to the chat
  const addMessage = (content: string, role: "user" | "assistant" | "system") => {
    const timestamp = new Date().toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    setMessages((prev) => [
      ...prev,
      { content, role, timestamp }
    ]);
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isProcessing) {
      processUserInput(inputValue.trim());
      setInputValue("");
    }
  };

  // Process text input
  const processUserInput = async (text: string) => {
    try {
      setIsProcessing(true);
      logger.debug("chat", "Processing text input:", { text });
      
      // Display user message
      addMessage(text, "user");
      
      try {
        // Process with AI service
        const result = await processText(text);
        logger.debug("chat", "AI response received", { 
          responseLength: result.response.length 
        });
        
        // Display assistant response
        addMessage(result.response, "assistant");
      } catch (error) {
        // If there's an error with the API, simulate a response
        logger.error("chat", "Error with API, using fallback response", error);
        addMessage("I'm having trouble connecting to the AI service right now. Please try again later.", "assistant");
      }
    } catch (error) {
      logger.error("chat", "Error in text processing:", error);
      addMessage(`Sorry, I encountered an error: ${(error as Error).message}`, "assistant");
    } finally {
      setIsProcessing(false);
    }
  };

  // Format message content with code blocks
  const formatMessage = (content: string) => {
    // Simple regex to detect code blocks (text between triple backticks)
    const codeBlockRegex = /```([\s\S]*?)```/g;
    const parts = content.split(codeBlockRegex);

    // No code blocks, just return the text
    if (parts.length === 1) {
      return <p className="whitespace-pre-wrap">{content}</p>;
    }

    // If there are code blocks, process them
    return (
      <div className="whitespace-pre-wrap">
        {parts.map((part, index) => {
          // Even indices are regular text, odd indices are code
          if (index % 2 === 0) {
            return <span key={index}>{part}</span>;
          } else {
            // Try to detect language
            const firstLine = part.trim().split('\n')[0];
            const language = firstLine && !firstLine.includes(' ') ? firstLine : '';
            const code = language ? part.substring(language.length).trim() : part;
            
            return (
              <pre 
                key={index} 
                className="bg-gray-100 dark:bg-gray-800 p-3 my-2 rounded-md overflow-x-auto font-mono text-sm"
              >
                {language && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-sans">
                    {language}
                  </div>
                )}
                <code>{code}</code>
              </pre>
            );
          }
        })}
      </div>
    );
  };

  return (
    <ErrorBoundary componentName="ChatMode">
      <div className="flex flex-col h-screen max-h-[75vh] md:h-[75vh] w-full max-w-2xl mx-auto rounded-xl overflow-hidden shadow-xl bg-white dark:bg-gray-900">
        {/* Messages Display */}
        <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-gray-800">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              <p>Start a conversation by typing a message</p>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((message, index) => (
                <div 
                  key={index} 
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-400 to-purple-500 flex items-center justify-center shadow-md mr-2">
                      <Bot size={16} className="text-white" />
                    </div>
                  )}
                  
                  <div 
                    className={`relative max-w-[80%] rounded-lg px-4 py-3 ${
                      message.role === 'user' 
                        ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white' 
                        : message.role === 'assistant'
                          ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-pink-100 dark:border-gray-700 shadow-md' 
                          : 'bg-gray-100 dark:bg-gray-900 text-gray-500 italic text-sm'
                    }`}
                  >
                    {formatMessage(message.content)}
                  </div>
                  
                  {message.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-400 flex items-center justify-center shadow-md ml-2">
                      <User size={16} className="text-white" />
                    </div>
                  )}
                </div>
              ))}
              
              {isProcessing && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-400 to-purple-500 flex items-center justify-center shadow-md mr-2">
                    <Bot size={16} className="text-white" />
                  </div>
                  <div className="max-w-[80%] rounded-lg px-4 py-3 bg-white dark:bg-gray-800 border border-pink-100 dark:border-gray-700">
                    <div className="flex items-center space-x-2">
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        Thinking...
                      </div>
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse"></div>
                        <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse delay-100"></div>
                        <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse delay-200"></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div className="p-4 bg-white dark:bg-gray-800 border-t border-pink-100 dark:border-gray-700">
          <form onSubmit={handleSubmit} className="flex items-end space-x-2">
            <div className="relative flex-1 border border-pink-300 dark:border-gray-600 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-pink-400 dark:focus-within:ring-purple-500 focus-within:border-transparent">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Message Assistant..."
                className="w-full max-h-40 resize-none px-4 py-3 bg-transparent focus:outline-none"
                rows={1}
                disabled={isProcessing}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
            </div>
            
            <button
              type="submit"
              className={`
                p-3 rounded-xl focus:outline-none transition-colors shadow-md
                ${isProcessing || inputValue.trim() === ''
                  ? 'bg-pink-300 dark:bg-gray-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700'}
                text-white
              `}
              disabled={isProcessing || inputValue.trim() === ''}
              title="Send message"
              aria-label="Send message"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </ErrorBoundary>
  );
}