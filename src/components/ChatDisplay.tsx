"use client";

import { useEffect, useRef, useState } from "react";
import { useStateLogger } from "@/utils/stateLogger";
import logger from "@/utils/logger";
import { useLogger } from "@/contexts/LoggerContext";
import performanceUtils from "@/utils/performance";
import ErrorBoundary from "@/components/ErrorBoundary";

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

  // Function to detect code blocks with language
  const detectCodeBlockLanguage = (codeBlock: string): string => {
    // Check for language identifier at the beginning of the code block
    const firstLine = codeBlock.trim().split('\n')[0];
    const languageMatch = /^[a-zA-Z0-9#+-]+/.exec(firstLine);
    
    if (languageMatch && languageMatch[0]) {
      // Common language identifiers
      const commonLanguages = ['javascript', 'typescript', 'python', 'html', 'css', 'java', 'c', 'cpp', 'csharp', 'php', 'ruby', 'go', 'rust', 'swift', 'kotlin', 'shell', 'bash', 'json', 'xml', 'yaml', 'sql'];
      const detectedLang = languageMatch[0].toLowerCase();
      
      if (commonLanguages.includes(detectedLang) || 
          commonLanguages.some(lang => detectedLang.includes(lang))) {
        return detectedLang;
      }
    }
    
    // Try to guess language from content
    if (codeBlock.includes('function') && (codeBlock.includes('=>') || codeBlock.includes('{'))) {
      return 'javascript';
    }
    if (codeBlock.includes('import') && codeBlock.includes('from') && codeBlock.includes('def ')) {
      return 'python';
    }
    if (codeBlock.includes('<html') || (codeBlock.includes('<div') && codeBlock.includes('</div>'))) {
      return 'html';
    }
    if (codeBlock.includes('SELECT') && codeBlock.includes('FROM') && codeBlock.includes('WHERE')) {
      return 'sql';
    }
    
    // Default
    return '';
  };

  // Function to format message content with code blocks
  const formatMessage = (content: string) => {
    performanceUtils.start('format-message');
    
    try {
      // Simple regex to detect code blocks (text between triple backticks)
      const codeBlockRegex = /```([\s\S]*?)```/g;
      const parts = content.split(codeBlockRegex);

      // No code blocks, just return the text
      if (parts.length === 1) {
        const result = <p className="whitespace-pre-wrap">{content}</p>;
        performanceUtils.end('format-message');
        return result;
      }

      // If there are code blocks, process them
      const result = (
        <div className="whitespace-pre-wrap">
          {parts.map((part, index) => {
            // Even indices are regular text, odd indices are code
            if (index % 2 === 0) {
              return <span key={index}>{part}</span>;
            } else {
              const language = detectCodeBlockLanguage(part);
              return (
                <pre 
                  key={index} 
                  className={`bg-gray-100 dark:bg-gray-800 p-3 my-2 rounded-md overflow-x-auto font-mono text-sm ${language ? `language-${language}` : ''}`}
                  data-language={language || 'text'}
                >
                  {language && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-sans">
                      {language}
                    </div>
                  )}
                  <code>{part}</code>
                </pre>
              );
            }
          })}
        </div>
      );
      
      performanceUtils.end('format-message');
      return result;
    } catch (error) {
      logger.error('ui', 'Error formatting message:', { error, content });
      performance.end('format-message');
      return <p className="whitespace-pre-wrap">{content}</p>;
    }
  };

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
                {formatMessage(message.content)}
                
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