"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Mic, Square, Bot, User } from "lucide-react";

// Types for our messages
type MessageType = "user" | "assistant" | "system";

interface Message {
  content: string;
  type: MessageType;
  timestamp: string;
}

interface VoiceAssistantProps {
  activeMicId: string;
}

export default function VoiceAssistant({ activeMicId }: VoiceAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [status, setStatus] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [pulseSize, setPulseSize] = useState(0);
  // Removed local activeMicId state since it's passed as prop
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Refs for audio handling
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Add initial greeting message
  useEffect(() => {
    addMessage(
      "Welcome to Combined Mode. You can type your message or use the microphone to speak.",
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
    if (inputValue.trim() && !isProcessing && !isRecording) {
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
      setStatus("Processing with Toolhouse...");
      
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
      setStatus("");
      setIsProcessing(false);
    }
  };

  // Handle toggle recording
  const toggleRecording = async () => {
    // If we're already processing and not recording, don't allow starting a recording
    if (isProcessing && !isRecording) return;
    
    if (!isRecording) {
      try {
        setStatus("Listening...");
        await startRecording();
        setIsRecording(true);
      } catch (error) {
        console.error("Error starting recording:", error);
        setStatus("");
        addMessage(`Sorry, I couldn't access your microphone: ${(error as Error).message}`, "assistant");
      }
    } else {
      stopRecording();
      setIsRecording(false);
      setStatus("Processing...");
    }
  };

  // Start audio recording
  const startRecording = async () => {
    try {
      // Request microphone access with better audio quality and specific device if selected
      const constraints: MediaStreamConstraints = {
        audio: activeMicId 
          ? {
              deviceId: { exact: activeMicId },
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            } 
          : {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
      };
      
      console.log("Starting recording with mic ID:", activeMicId);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Set up media recorder with audio/webm MIME type which is widely supported
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      // Handle data available event
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      // Start recording
      mediaRecorder.start(100); // Collect data in 100ms chunks
      
      console.log("Recording started with improved settings" + (activeMicId ? ` using mic ID: ${activeMicId}` : ""));
    } catch (error) {
      console.error("Error starting recording:", error);
      throw error;
    }
  };

  // Stop audio recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      // Stop media recorder
      mediaRecorderRef.current.stop();
      
      // Process audio when stopped
      mediaRecorderRef.current.onstop = async () => {
        try {
          console.log("Recording stopped, processing audio...");
          
          // Create audio blob
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm;codecs=opus" });
          
          if (audioBlob.size > 0) {
            console.log("Audio blob size:", audioBlob.size);
            await processAudio(audioBlob);
          } else {
            setStatus("");
            addMessage("I couldn't detect any speech. Please try again.", "assistant");
          }
        } catch (error) {
          console.error("Error processing audio:", error);
          setStatus("");
          addMessage(`Sorry, I encountered an error: ${(error as Error).message}`, "assistant");
        }
      };
    }
    
    // Stop all audio tracks
    mediaRecorderRef.current?.stream.getTracks().forEach((track) => track.stop());
  };

  // Process recorded audio
  const processAudio = async (audioBlob: Blob) => {
    try {
      setIsProcessing(true);
      setStatus("Transcribing audio...");
      
      // Create form data for the API
      const formData = new FormData();
      formData.append("file", audioBlob, "recording.webm");
      
      console.log("Sending audio to transcription API, blob size:", audioBlob.size, "type:", audioBlob.type);
      
      // Send to our Next.js API route for transcription
      const transcriptionResponse = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      
      if (!transcriptionResponse.ok) {
        const errorText = await transcriptionResponse.text();
        console.error("Transcription API error:", errorText);
        throw new Error(`Transcription failed: ${transcriptionResponse.status} ${transcriptionResponse.statusText}`);
      }
      
      const transcriptionResult = await transcriptionResponse.json();
      const userText = transcriptionResult.text;
      
      console.log("Transcription result:", userText);
      
      if (userText && userText.trim()) {
        // Display user message
        addMessage(userText, "user");
        
        // Process with Toolhouse through our API
        setStatus("Processing with Toolhouse...");
        
        const toolhouseResponse = await fetch("/api/process", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: userText }),
        });
        
        if (!toolhouseResponse.ok) {
          const errorData = await toolhouseResponse.json();
          throw new Error(`Processing failed: ${errorData.error || toolhouseResponse.statusText}`);
        }
        
        const toolhouseResult = await toolhouseResponse.json();
        console.log("Toolhouse response:", toolhouseResult);
        
        // Display assistant response
        addMessage(toolhouseResult.response, "assistant");
      } else {
        addMessage("I couldn't understand what you said. Please try again.", "assistant");
      }
    } catch (error) {
      console.error("Error in audio processing:", error);
      addMessage(`Sorry, I encountered an error: ${(error as Error).message}`, "assistant");
    } finally {
      setStatus("");
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

  // Render pulse circles for recording animation
  const renderPulseCircles = () => {
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
  };

  return (
    <div className="flex flex-col h-screen max-h-[75vh] md:h-[75vh] w-full max-w-2xl mx-auto rounded-xl overflow-hidden shadow-xl bg-white dark:bg-gray-900">
      {/* Messages Display */}
      <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-teal-50 to-white dark:from-gray-900 dark:to-gray-800">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400">
            <p>Start a conversation by typing or speaking</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.type === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-teal-400 to-emerald-500 flex items-center justify-center mr-2 shadow-md">
                    <Bot size={16} className="text-white" />
                  </div>
                )}
                <div
                  className={`
                    max-w-[80%] rounded-xl p-4 shadow-md
                    ${message.type === 'user'
                      ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white'
                      : message.type === 'assistant'
                        ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-teal-100 dark:border-gray-700'
                        : 'bg-gray-100 dark:bg-gray-900 text-gray-500 italic text-sm'
                    }
                  `}
                >
                  {formatMessage(message.content)}
                </div>
                {message.type === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 flex items-center justify-center ml-2 shadow-md">
                    <User size={16} className="text-white" />
                  </div>
                )}
              </div>
            ))}

            {isProcessing && !isRecording && (
              <div className="flex justify-start">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-teal-400 to-emerald-500 flex items-center justify-center mr-2 shadow-md">
                  <Bot size={16} className="text-white" />
                </div>
                <div className="max-w-[80%] rounded-xl p-4 bg-white dark:bg-gray-800 border border-teal-100 dark:border-gray-700 shadow-md">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></div>
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse delay-100"></div>
                    <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse delay-200"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white dark:bg-gray-800 border-t border-teal-100 dark:border-gray-700">
        <form onSubmit={handleSubmit} className="flex items-end space-x-2">
          <div className="relative flex-1 border border-teal-300 dark:border-gray-600 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-teal-400 dark:focus-within:ring-emerald-500 focus-within:border-transparent">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Message Toolhouse Assistant..."
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
        
        {(status && (isRecording || isProcessing)) && (
          <div className="mt-2 text-center text-sm text-teal-600 dark:text-teal-400 font-medium">
            {status}
          </div>
        )}
      </div>
    </div>
  );
}