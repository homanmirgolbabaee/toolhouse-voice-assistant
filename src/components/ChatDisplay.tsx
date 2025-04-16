"use client";

import { useEffect, useRef, useState } from "react";
import { useStateLogger } from "@/utils/stateLogger";
import logger from "@/utils/logger";
import { useLogger } from "@/contexts/LoggerContext";
import performanceUtils from "@/utils/performance";
import ErrorBoundary from "@/components/ErrorBoundary";
import MessageFormatter from "./MessageFormatter";

interface Message {
  content: string;
  type: "user" | "assistant" | "system";
  timestamp: string;
  id?: string; // Added for tracking
}

interface ChatDisplayProps {
  messages: Message[];
  isThinking?: boolean;
}

function ChatDisplay({ messages, isThinking = false }: ChatDisplayProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const previousMessagesLengthRef = useRef<number>(0);
  const { logEvent } = useLogger();
  const [renderCount, setRenderCount] = useState(0);

  // Log when the component renders
  useEffect(() => {
    setRenderCount(prev => prev + 1);
    logger.debug('ui', `ChatDisplay rendered (${renderCount + 1})`);
    
    // Track component performance
    const startTime = window.performance.now();
    return () => {
      const renderTime = window.performance.now() - startTime;
      logger.debug('performance', `ChatDisplay render time: ${renderTime.toFixed(2)}ms`);
    };
  });

  // Use state logger to track messages state changes
  useStateLogger('chatMessages', messages);
  useStateLogger('isThinking', isThinking);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const scrollToBottom = () => {
      const startTime = window.performance.now();
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      const scrollTime = window.performance.now() - startTime;
      
      if (scrollTime > 50) {
        logger.debug('performance', `ChatDisplay scroll took ${scrollTime.toFixed(2)}ms`);
      }
    };

    // Log when new messages arrive
    if (messages.length > previousMessagesLengthRef.current) {
      const newMessages = messages.slice(previousMessagesLengthRef.current);
      
      newMessages.forEach((msg) => {
        logger.debug('chat', `New message received [${msg.type}]:`, {
          content: msg.content.length > 100 ? `${msg.content.substring(0, 100)}...` : msg.content,
          timestamp: msg.timestamp,
          id: msg.id,
          length: msg.content.length
        });
      });
      
      // Log event for analytics
      logEvent('chat', 'new_message', { 
        count: newMessages.length,
        last_type: newMessages[newMessages.length - 1].type
      });
    }
    
    previousMessagesLengthRef.current = messages.length;
    
    // Scroll to bottom with a small delay to ensure content is rendered
    const timeoutId = setTimeout(scrollToBottom, 100);
    return () => clearTimeout(timeoutId);
  }, [messages, isThinking, logEvent]);

  return (
    <div className="flex-1 overflow-y-auto p-4 bg-white dark:bg-gray-800">
      {messages.length === 0 ? (
        <div className="h-full flex items-center justify-center text-gray-400">
          <p>Start a conversation by typing a message or using voice input</p>
        </div>
      ) : (
        <div className="space-y-6">
          {messages.map((message, index) => (
            <div 
              key={index} 
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              data-message-type={message.type}
              data-message-id={message.id || index}
            >
              <div 
                className={`max-w-[80%] rounded-lg px-4 py-3 ${
                  message.type === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : message.type === 'assistant'
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100' 
                      : 'bg-gray-100 dark:bg-gray-900 text-gray-500 italic text-sm'
                }`}
              >
                <MessageFormatter 
                  content={message.content} 
                  className="prose prose-sm dark:prose-invert max-w-none"
                />
                
                {/* Debug timestamp in development mode */}
                {process.env.NODE_ENV === 'development' && (
                  <div className="mt-2 text-xs opacity-50">
                    {message.timestamp}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isThinking && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse"></div>
                  <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse delay-100"></div>
                  <div className="w-2 h-2 rounded-full bg-gray-500 animate-pulse delay-200"></div>
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

// Export with error boundary wrapper
export default function ChatDisplayWithErrorHandling(props: ChatDisplayProps) {
  return (
    <ErrorBoundary componentName="ChatDisplay">
      <ChatDisplay {...props} />
    </ErrorBoundary>
  );
}