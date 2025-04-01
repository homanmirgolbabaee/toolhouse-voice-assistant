"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User } from "lucide-react";

// Message types
type MessageType = "user" | "assistant" | "system";

interface Message {
  content: string;
  type: MessageType;
  timestamp: string;
}

export default function ChatOnlyMode() {
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

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "24px";
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  // Function to add a message to the chat
  const addMessage = (content: string, type: MessageType) => {
    const timestamp = new Date().toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    setMessages((prev) => [
      ...prev,
      { content, type, timestamp }
    ]);
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !isProcessing) {
      processText(inputValue.trim());
      setInputValue("");
    }
  };

  // Process text input
  const processText = async (text: string) => {
    try {
      setIsProcessing(true);
      console.log("Processing text input:", text);
      
      // Display user message
      addMessage(text, "user");
      
      // Process with Toolhouse
      const toolhouseResponse = await fetch("/api/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      });
      
      if (!toolhouseResponse.ok) {
        const errorData = await toolhouseResponse.json();
        throw new Error(`Processing failed: ${errorData.error || toolhouseResponse.statusText}`);
      }
      
      const toolhouseResult = await toolhouseResponse.json();
      console.log("Toolhouse response:", toolhouseResult);
      
      // Display assistant response
      addMessage(toolhouseResult.response, "assistant");
    } catch (error) {
      console.error("Error in text processing:", error);
      addMessage(`Sorry, I encountered an error: ${(error as Error).message}`, "assistant");
    } finally {
      setIsProcessing(false);
    }
  };

  // Function to format message content with code blocks
  const formatMessage = (content: string) => {
    // Simple regex to detect code blocks (text between triple backticks)
    const codeBlockRegex = /```([\s\S]*?)```/g;
    const parts = content.split(codeBlockRegex);

    if (parts.length === 1) {
      // No code blocks, just return the text
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
            return (
              <pre key={index} className="bg-gray-100 dark:bg-gray-900 p-3 my-2 rounded-md overflow-x-auto font-mono text-sm">
                <code>{part}</code>
              </pre>
            );
          }
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen max-h-[75vh] md:h-[75vh] w-full max-w-2xl mx-auto rounded-xl overflow-hidden shadow-xl bg-white dark:bg-gray-900">
      {/* Messages Display */}
      <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-pink-50 to-white dark:from-gray-900 dark:to-gray-800">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400">
            <p>Start a conversation by typing a message</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.type === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-400 to-purple-500 flex items-center justify-center mr-2 shadow-md">
                    <Bot size={16} className="text-white" />
                  </div>
                )}
                <div
                  className={`
                    max-w-[80%] rounded-xl p-4 shadow-md
                    ${message.type === 'user'
                      ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white'
                      : message.type === 'assistant'
                        ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-pink-100 dark:border-gray-700'
                        : 'bg-gray-100 dark:bg-gray-900 text-gray-500 italic text-sm'
                    }
                  `}
                >
                  {formatMessage(message.content)}
                </div>
                {message.type === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-400 flex items-center justify-center ml-2 shadow-md">
                    <User size={16} className="text-white" />
                  </div>
                )}
              </div>
            ))}

            {isProcessing && (
              <div className="flex justify-start">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-400 to-purple-500 flex items-center justify-center mr-2 shadow-md">
                  <Bot size={16} className="text-white" />
                </div>
                <div className="max-w-[80%] rounded-xl p-4 bg-white dark:bg-gray-800 border border-pink-100 dark:border-gray-700 shadow-md">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse"></div>
                    <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse delay-100"></div>
                    <div className="w-2 h-2 rounded-full bg-pink-500 animate-pulse delay-200"></div>
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
              placeholder="Message Toolhouse Assistant..."
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
  );
}