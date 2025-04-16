// app/documents/[id]/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Document, Block } from "@/models/document";
import { getDocument, updateDocument, deleteDocument } from "@/services/documentService";
import BlockEditor from "@/components/editor/BlockEditor";
import { ArrowLeft, Bot, Mic, MessageCircle, Save, Settings, X, Share, Download, File, Send } from "lucide-react";
import logger from "@/utils/logger";
import { useLogger } from "@/contexts/LoggerContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import { v4 as uuidv4 } from "uuid";
import SimplifiedVoiceRecorder from "@/components/SimplifiedVoiceRecorder";
import performanceUtils from "@/utils/performance";





export default function DocumentPage() {
  const { id } = useParams();
  const router = useRouter();
  const { logEvent } = useLogger();
  
  const [document, setDocument] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [showChatAssistant, setShowChatAssistant] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{role: string; content: string}>>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [chatExpanded, setChatExpanded] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isAutosaving, setIsAutosaving] = useState(false);
  
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load document when component mounts
  useEffect(() => {
    const loadDocument = async () => {
      try {
        setIsLoading(true);
        performanceUtils.start('load-document');
        
        // Convert id to string if it's an array
        const documentId = Array.isArray(id) ? id[0] : id as string;
        
        const doc = await getDocument(documentId);
        setDocument(doc);
        setTitle(doc.title);
        setLastSaved(new Date(doc.updatedAt));
        
        // Initialize chat if metadata exists
        if (doc.metadata?.chatHistory) {
          setChatMessages(doc.metadata.chatHistory);
        }
        
        performanceUtils.end('load-document');
        logEvent('document', 'open_document', { documentId });
        logger.info('document', `Document loaded: ${doc.title}`, {
          documentId: doc.id,
          blockCount: doc.blocks.length
        });
      } catch (err) {
        setError(`Failed to load document: ${(err as Error).message}`);
        logger.error('document', 'Error loading document', { error: err });
      } finally {
        setIsLoading(false);
      }
    };

    loadDocument();
  }, [id, logEvent]);
  
  // Auto-scroll chat to bottom when messages change
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Toggle chat expanded state
  const toggleChatExpanded = () => {
    setChatExpanded(!chatExpanded);
  };

  // Handle title change
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    setIsAutosaving(true);
  };

  // Title blur - save document if title changed
  const handleTitleBlur = async () => {
    if (!document || title === document.title) return;
    await handleSave();
  };

  // Save document
  const handleSave = async () => {
    if (!document) return;
    
    try {
      setIsSaving(true);
      performanceUtils.start('save-document');
      
      const updatedDoc = {
        ...document,
        title,
        updatedAt: new Date(),
        metadata: {
          ...document.metadata,
          chatHistory: chatMessages
        }
      };
      
      await updateDocument(updatedDoc);
      setDocument(updatedDoc);
      setLastSaved(new Date());
      setIsAutosaving(false);
      
      // Show save notification
      setNotificationMessage("Document saved");
      setTimeout(() => setNotificationMessage(""), 2000);

      performanceUtils.end('save-document');
      logger.info('document', `Document saved: ${title}`, {
        documentId: document.id
      });
    } catch (err) {
      setError(`Failed to save document: ${(err as Error).message}`);
      logger.error('document', 'Error saving document', { error: err });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle blocks update
  const handleBlocksUpdate = async (updatedBlocks: Block[]) => {
    if (!document) return;
    
    try {
      const updatedDoc = {
        ...document,
        blocks: updatedBlocks,
        updatedAt: new Date()
      };
      
      await updateDocument(updatedDoc);
      setDocument(updatedDoc);
      setLastSaved(new Date());
      
      logger.debug('document', `Blocks updated: ${updatedBlocks.length} blocks`);
    } catch (err) {
      logger.error('document', 'Error updating blocks', { error: err });
    }
  };
  
  // Save chat message to document as a new block
  const saveMessageToNote = (content: string) => {
    if (!document || !content) return;
    
    // Create a new block with the content
    const newBlock: Block = {
      id: uuidv4(),
      type: "text",
      content
    };
    
    // Add to document blocks
    const updatedBlocks = [...document.blocks, newBlock];
    handleBlocksUpdate(updatedBlocks);
    
    // Show a small confirmation
    setNotificationMessage("Added to note");
    setTimeout(() => setNotificationMessage(""), 2000);
  };
  
  // Handle Send Message in Chat
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isProcessing) return;
    
    // Add user message to chat
    const userMessage = { role: "user", content: inputMessage };
    setChatMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    
    // Process with API
    try {
      setIsProcessing(true);
      performanceUtils.start('process-message');
      
      const response = await fetch("/api/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          text: inputMessage,
          documentContext: document?.blocks.map(b => b.content).join("\n") 
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Processing failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      performanceUtils.end('process-message');
      
      // Add assistant response to chat
      const assistantMessage = { role: "assistant", content: result.response };
      setChatMessages(prev => [...prev, assistantMessage]);
      
      // Save updated chat history
      if (document) {
        const updatedDoc = {
          ...document,
          metadata: {
            ...document.metadata,
            chatHistory: [...chatMessages, userMessage, assistantMessage]
          }
        };
        
        await updateDocument(updatedDoc);
        setDocument(updatedDoc);
        setLastSaved(new Date());
      }
    } catch (err) {
      logger.error('chat', 'Error processing message', { error: err });
      setChatMessages(prev => [...prev, { 
        role: "assistant", 
        content: `Sorry, I encountered an error: ${(err as Error).message}` 
      }]);
    } finally {
      setIsProcessing(false);
      
      // Focus back on input after processing
      if (messageInputRef.current) {
        messageInputRef.current.focus();
      }
    }
  };
  
  // Handle document deletion
  const handleDeleteDocument = async () => {
    if (!document) return;
    
    // Show confirmation dialog with document title
    if (!window.confirm(`Are you sure you want to delete "${document.title}"? This action cannot be undone.`)) {
      return;
    }
    
    try {
      setIsSaving(true);
      performanceUtils.start('delete-document');
      
      // Delete the document
      await deleteDocument(document.id);
      
      performanceUtils.end('delete-document');
      logger.info('document', `Document deleted: ${document.id}`, {
        documentId: document.id
      });
      
      // Show a small confirmation
      setNotificationMessage("Document deleted");
      
      // Navigate back to home page
      setTimeout(() => {
        router.push('/');
      }, 1000);
    } catch (err) {
      setError(`Failed to delete document: ${(err as Error).message}`);
      logger.error('document', 'Error deleting document', { error: err });
      setIsSaving(false);
    }
  };

  // Share document - create a shareable link (mock for now)
  const handleShareDocument = () => {
    // In a real app, this would create a shareable link or open a share dialog
    navigator.clipboard.writeText(`${window.location.origin}/documents/${document?.id}`);
    setNotificationMessage("Link copied to clipboard");
    setTimeout(() => setNotificationMessage(""), 2000);
  };

  // Export document as markdown (simple implementation)
  const handleExportDocument = () => {
    if (!document) return;
    
    try {
      // Convert blocks to markdown
      let markdown = `# ${document.title}\n\n`;
      
      document.blocks.forEach(block => {
        switch (block.type) {
          case 'heading':
            const level = block.properties?.level || 1;
            markdown += `${'#'.repeat(level)} ${block.content}\n\n`;
            break;
          case 'text':
            markdown += `${block.content}\n\n`;
            break;
          case 'list':
            markdown += `- ${block.content}\n`;
            break;
          case 'todo':
            markdown += `- [${block.properties?.checked ? 'x' : ' '}] ${block.content}\n`;
            break;
          case 'code':
            markdown += `\`\`\`${block.properties?.language || ''}\n${block.content}\n\`\`\`\n\n`;
            break;
          default:
            markdown += `${block.content}\n\n`;
        }
      });
      
      // Create a blob and download link
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${document.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setNotificationMessage("Document exported");
      setTimeout(() => setNotificationMessage(""), 2000);
    } catch (err) {
      logger.error('document', 'Error exporting document', { error: err });
      setNotificationMessage("Failed to export document");
      setTimeout(() => setNotificationMessage(""), 2000);
    }
  };

  // Handle audio capture from voice recorder
  const handleAudioCaptured = async (audioBlob: Blob) => {
    try {
      setIsProcessing(true);
      performanceUtils.start('process-audio');
      
      // Create form data for the API
      const formData = new FormData();
      formData.append("file", audioBlob, "recording.webm");
      
      // Transcribe audio
      const transcriptionResponse = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      
      if (!transcriptionResponse.ok) {
        throw new Error("Transcription failed");
      }
      
      const { text } = await transcriptionResponse.json();
      
      if (!text || text.trim() === "") {
        throw new Error("I couldn't understand what you said. Please try again.");
      }
      
      // Add the transcribed text as user message
      const userMessage = { role: "user", content: text };
      setChatMessages(prev => [...prev, userMessage]);
      
      // Process with API
      const processingResponse = await fetch("/api/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text,
          documentContext: document?.blocks.map(b => b.content).join("\n") 
        }),
      });
      
      performanceUtils.end('process-audio');
      
      if (!processingResponse.ok) {
        throw new Error("Processing failed");
      }
      
      const result = await processingResponse.json();
      
      // Add assistant response to chat
      const assistantMessage = { role: "assistant", content: result.response };
      setChatMessages(prev => [...prev, assistantMessage]);
      
      // Save updated chat history
      if (document) {
        const updatedDoc = {
          ...document,
          metadata: {
            ...document.metadata,
            chatHistory: [...chatMessages, userMessage, assistantMessage]
          }
        };
        
        await updateDocument(updatedDoc);
        setDocument(updatedDoc);
        setLastSaved(new Date());
      }
    } catch (err) {
      logger.error('chat', 'Error processing voice input', { error: err });
      setChatMessages(prev => [...prev, { 
        role: "assistant", 
        content: `Sorry, I encountered an error: ${(err as Error).message}` 
      }]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Format the last saved time
  const formatLastSavedTime = () => {
    if (!lastSaved) return "";
    
    const now = new Date();
    const diffMs = now.getTime() - lastSaved.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 60) {
      return "Just now";
    } else if (diffSec < 3600) {
      const mins = Math.floor(diffSec / 60);
      return `${mins} minute${mins > 1 ? 's' : ''} ago`;
    } else if (diffSec < 86400) {
      const hours = Math.floor(diffSec / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      return lastSaved.toLocaleString();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-pulse text-lg flex items-center">
          <File className="animate-pulse mr-2 text-blue-500" />
          Loading document...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 p-4 rounded-md max-w-md">
          <h2 className="text-lg font-bold mb-2">Error</h2>
          <p>{error}</p>
          <div className="mt-4 flex space-x-4">
            <button 
              className="px-4 py-2 bg-red-600 text-white rounded-md"
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
            <Link href="/" className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-md">
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-4">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 p-4 rounded-md max-w-md">
          <h2 className="text-lg font-bold mb-2">Document Not Found</h2>
          <p>The document you are looking for does not exist or has been deleted.</p>
          <Link href="/" className="mt-4 inline-block px-4 py-2 bg-yellow-600 text-white rounded-md">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary componentName="DocumentPage">
      <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="mr-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
              <ArrowLeft size={20} />
            </Link>
              
            <div>
              <input
                ref={titleInputRef}
                type="text"
                value={title}
                onChange={handleTitleChange}
                onBlur={handleTitleBlur}
                className="text-2xl font-bold bg-transparent border-none focus:outline-none focus:ring-0 w-full max-w-lg"
                placeholder="Untitled"
              />
              <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                {isSaving ? (
                  <span className="flex items-center">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2 animate-ping"></span>
                    Saving...
                  </span>
                ) : isAutosaving ? (
                  <span className="flex items-center">
                    <span className="inline-block w-2 h-2 rounded-full bg-yellow-500 mr-2"></span>
                    Unsaved changes
                  </span>
                ) : (
                  <span>Last edited: {formatLastSavedTime()}</span>
                )}
              </div>
            </div>
          </div>
            
          <div className="flex items-center space-x-3">
          {/* <DocumentTTS document={document} /> */}

            <button
              onClick={handleShareDocument}
              className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
              title="Share"
            >
              <Share size={20} />
            </button>
            <button
              onClick={handleExportDocument}
              className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
              title="Export"
            >
              <Download size={20} />
            </button>
            <button
              onClick={() => setShowChatAssistant(!showChatAssistant)}
              className={`p-2 rounded-md ${
                showChatAssistant 
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
              title="Chat Assistant"
            >
              <MessageCircle size={20} />
            </button>
            
            <button
              onClick={handleSave}
              className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
              title="Save"
            >
              <Save size={20} />
            </button>
          </div>
        </div>
        </header>
  
        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Document Editor */}
          <main className="flex-1 overflow-auto">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <BlockEditor 
                initialBlocks={document.blocks} 
                onSave={handleBlocksUpdate}
                documentId={document.id}
                onDeleteDocument={handleDeleteDocument}
              />
            </div>
          </main>
          
          {/* Chat Assistant */}
          {showChatAssistant && (
            <aside className={`
              border-l border-gray-200 dark:border-gray-800 flex flex-col bg-gray-50 dark:bg-gray-900
              transition-all duration-300 ease-in-out
              ${chatExpanded ? 'w-full md:w-1/2' : 'w-full md:w-1/3'}
            `}>
              <div className="p-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <h2 className="font-medium text-lg flex items-center">
                  <Bot size={18} className="mr-2 text-blue-600" />
                  Assistant
                </h2>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={toggleChatExpanded}
                    className="p-1 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
                    title={chatExpanded ? "Collapse" : "Expand"}
                  >
                    {chatExpanded ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"></polyline>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => setShowChatAssistant(false)}
                    className="p-1 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              
              {/* Chat Messages */}
              <div 
                ref={chatContainerRef}
                className="flex-1 overflow-auto p-4 space-y-4"
              >
                {chatMessages.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <Bot size={32} className="mx-auto mb-2 text-gray-400" />
                    <p>Ask me anything about this document or any other questions.</p>
                    <div className="mt-4 grid grid-cols-2 gap-2 max-w-md mx-auto">
                      <button 
                        onClick={() => {
                          setInputMessage("Summarize this note");
                          setTimeout(() => handleSendMessage(), 100);
                        }}
                        className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-700"
                      >
                        Summarize this note
                      </button>
                      <button 
                        onClick={() => {
                          setInputMessage("Add headings to organize this content");
                          setTimeout(() => handleSendMessage(), 100);
                        }}
                        className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-700"
                      >
                        Add headings
                      </button>
                      <button 
                        onClick={() => {
                          setInputMessage("What are the key points?");
                          setTimeout(() => handleSendMessage(), 100);
                        }}
                        className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-700"
                      >
                        Extract key points
                      </button>
                      <button 
                        onClick={() => {
                          setInputMessage("Can you analyze this data?");
                          setTimeout(() => handleSendMessage(), 100);
                        }}
                        className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-700"
                      >
                        Analyze data
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Chat messages rendering with save to note functionality */}
                    {chatMessages.map((message, index) => (
                      <div 
                        key={index}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div 
                          className={`relative max-w-[85%] rounded-lg px-4 py-2 group ${
                            message.role === 'user' 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{message.content}</p>
                          
                          {/* Add to Note button (only for assistant messages) */}
                          {message.role === 'assistant' && (
                            <div className="absolute right-0 top-0 -mt-2 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => saveMessageToNote(message.content)}
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
                      </div>
                    ))}
                  </>
                )}
                
                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-lg px-4 py-2 bg-gray-200 dark:bg-gray-800">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></div>
                        <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse delay-100"></div>
                        <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse delay-200"></div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Ref for scrolling to the bottom */}
                <div ref={messagesEndRef}></div>
              </div>
              
              {/* Input Area */}
              <div className="p-3 border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-end space-x-2">
                <div className="flex-1 relative rounded-lg border border-gray-300 dark:border-gray-700 overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                    <textarea
                      ref={messageInputRef}
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 resize-none focus:outline-none min-h-[38px] pr-10"
                      placeholder="Message Assistant..."
                      rows={1}
                      disabled={isProcessing}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    {/* Mic button inside the textarea */}
                    <div className="absolute right-2 bottom-1.5">
                      <SimplifiedVoiceRecorder 
                        onAudioCaptured={handleAudioCaptured}
                        isProcessing={isProcessing}
                        size="sm"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isProcessing}
                    className={`px-3 py-2 rounded-lg ${
                      !inputMessage.trim() || isProcessing
                        ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </aside>
          )}
        </div>
        
        {/* Notification toast */}
        {notificationMessage && (
          <div className="fixed bottom-4 right-4 bg-black/80 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in-out">
            {notificationMessage}
          </div>
        )}

        {/* Keyboard shortcuts info - hidden, shows on '?' key press */}
        <div id="shortcuts-info" className="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md">
            <h3 className="text-lg font-bold mb-4">Keyboard Shortcuts</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center">
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 text-xs mr-2">/</kbd>
                <span>Open commands</span>
              </div>
              <div className="flex items-center">
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 text-xs mr-2">Enter</kbd>
                <span>New block</span>
              </div>
              <div className="flex items-center">
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 text-xs mr-2">Ctrl+S</kbd>
                <span>Save document</span>
              </div>
              <div className="flex items-center">
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 text-xs mr-2">Esc</kbd>
                <span>Close menus</span>
              </div>
            </div>
            <button
              onClick={() => {
                document.getElementById('shortcuts-info')?.classList.add('hidden');
              }}
              className="mt-4 w-full py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}