"use client";

import { useState, useRef, useEffect } from "react";
import { Volume2, User } from "lucide-react";
import SimplifiedVoiceRecorder from "./SimplifiedVoiceRecorder";

// Message types
type MessageType = "user" | "assistant" | "system";

interface Message {
  content: string;
  type: MessageType;
  timestamp: string;
}

interface VoiceOnlyModeProps {
  activeMicId: string;
}

export default function VoiceOnlyMode({ activeMicId }: VoiceOnlyModeProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Add initial greeting message
  useEffect(() => {
    addMessage(
      "Welcome to Voice Mode. Tap the microphone and speak clearly. The microphone will pulse as you speak.",
      "assistant"
    );
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  // Handle captured audio
  const handleAudioCaptured = async (audioBlob: Blob) => {
    setIsProcessing(true);
    setStatus("Processing your voice...");
    
    try {
      // Create form data for the API
      const formData = new FormData();
      formData.append("file", audioBlob, "recording.webm");
      
      // Step 1: Transcribe audio
      const transcriptionResponse = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      
      if (!transcriptionResponse.ok) {
        const errorText = await transcriptionResponse.text();
        console.error("Transcription error:", errorText);
        throw new Error("Sorry, I couldn't understand the audio");
      }
      
      const { text } = await transcriptionResponse.json();
      
      if (!text || text.trim() === "") {
        throw new Error("I couldn't hear anything. Please speak more clearly.");
      }
      
      console.log("Transcribed text:", text);
      addMessage(text, "user");
      
      // Step 2: Process with Toolhouse
      setStatus("Getting your answer...");
      
      const processingResponse = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      
      if (!processingResponse.ok) {
        throw new Error("Error processing your request");
      }
      
      const result = await processingResponse.json();
      addMessage(result.response, "assistant");
      
    } catch (error) {
      console.error("Voice processing error:", error);
      addMessage(`${(error as Error).message}`, "assistant");
    } finally {
      setIsProcessing(false);
      setStatus("");
    }
  };

  return (
    <div className="flex flex-col h-screen max-h-[75vh] md:h-[75vh] w-full max-w-2xl mx-auto rounded-xl overflow-hidden shadow-xl bg-white dark:bg-gray-900">
      {/* Messages Display */}
      <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.type === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center mr-2 shadow-md">
                  <Volume2 size={16} className="text-white" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-xl p-4 shadow-md
                  ${message.type === 'user'
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                    : message.type === 'assistant'
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-blue-100 dark:border-gray-700'
                      : 'bg-gray-100 dark:bg-gray-900 text-gray-500 italic text-sm'
                  }
                `}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
              {message.type === 'user' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 flex items-center justify-center ml-2 shadow-md">
                  <User size={16} className="text-white" />
                </div>
              )}
            </div>
          ))}

          {isProcessing && (
            <div className="flex justify-start">
              <div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-center mr-2 shadow-md">
                <Volume2 size={16} className="text-white" />
              </div>
              <div className="max-w-[80%] rounded-xl p-4 bg-white dark:bg-gray-800 border border-blue-100 dark:border-gray-700 shadow-md">
                <div className="flex items-center space-x-2">
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    {status || "Processing..."}
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
      </div>

      {/* Voice Control */}
      <div className="p-6 flex items-center justify-center bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <SimplifiedVoiceRecorder 
          onAudioCaptured={handleAudioCaptured}
          isProcessing={isProcessing}
          activeMicId={activeMicId}
        />
      </div>
    </div>
  );
}