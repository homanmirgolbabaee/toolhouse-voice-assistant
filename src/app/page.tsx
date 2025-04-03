// app/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { File, Plus, Search, Mic, MessageSquare, Bot } from "lucide-react";
import { Document } from "@/models/document";
import { getAllDocuments, createDocument } from "@/services/documentService";
import logger from "@/utils/logger";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

export default function HomePage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<'notes' | 'chat'>('notes');

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        setIsLoading(true);
        const docs = await getAllDocuments();
        setDocuments(docs);
        logger.info('document', `Loaded ${docs.length} documents`);
      } catch (error) {
        setError(`Failed to load documents: ${(error as Error).message}`);
        logger.error('document', 'Error loading documents', { error });
      } finally {
        setIsLoading(false);
      }
    };

    loadDocuments();
  }, []);

  const handleCreateDocument = async () => {
    try {
      const newDoc = await createDocument({
        title: "Untitled",
        blocks: [{ id: uuidv4(), type: "text", content: "" }]
      });
      
      setDocuments(prev => [newDoc, ...prev]);
      logger.info('document', 'Created new document', { documentId: newDoc.id });
      
      // Navigate to the new document
      router.push(`/documents/${newDoc.id}`);
    } catch (error) {
      setError(`Failed to create document: ${(error as Error).message}`);
      logger.error('document', 'Error creating document', { error });
    }
  };

  const filteredDocuments = searchQuery
    ? documents.filter(doc => 
        doc.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : documents;

  // Sort by latest updated
  const sortedDocuments = [...filteredDocuments].sort((a, b) => {
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return (
    <ErrorBoundary componentName="HomePage">
      <div className="min-h-screen bg-white dark:bg-gray-900">
        {/* Header */}
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <div className="flex items-center">
                <Bot className="h-8 w-8 text-blue-600" />
                <h1 className="ml-2 text-xl font-bold">NotesAI</h1>
              </div>
              
              <div className="flex items-center space-x-4">
                <button 
                  className={`px-3 py-1 rounded-md ${
                    activeMode === 'notes' 
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' 
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  onClick={() => setActiveMode('notes')}
                >
                  <File className="h-4 w-4 inline mr-1" />
                  Notes
                </button>
                
                <button 
                  className={`px-3 py-1 rounded-md ${
                    activeMode === 'chat' 
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' 
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  onClick={() => setActiveMode('chat')}
                >
                  <MessageSquare className="h-4 w-4 inline mr-1" />
                  Chat
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Notes Mode */}
          {activeMode === 'notes' && (
            <>
              {/* Page Title and Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
                <h2 className="text-2xl font-bold">My Notes</h2>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search notes..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2 w-full sm:w-60 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg"
                    />
                  </div>
                  
                  {/* Create Note Button */}
                  <button
                    onClick={handleCreateDocument}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    New Note
                  </button>
                </div>
              </div>
              
              {error && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg">
                  {error}
                  <button 
                    className="ml-2 underline"
                    onClick={() => window.location.reload()}
                  >
                    Retry
                  </button>
                </div>
              )}
              
              {/* Notes Grid */}
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : sortedDocuments.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <File className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium mb-2">No notes yet</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">
                    {searchQuery ? "No matching notes found" : "Create your first note to get started"}
                  </p>
                  {!searchQuery && (
                    <button
                      onClick={handleCreateDocument}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      Create Note
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sortedDocuments.map(doc => (
                    <Link 
                      key={doc.id}
                      href={`/documents/${doc.id}`}
                      className="block p-6 border border-gray-200 dark:border-gray-800 rounded-lg hover:shadow-md transition-shadow bg-white dark:bg-gray-800"
                    >
                      <h3 className="text-lg font-semibold mb-2 truncate">{doc.title || "Untitled"}</h3>
                      <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                        {doc.blocks[0]?.content || "No content yet"}
                      </p>
                      <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                        <span>{new Date(doc.updatedAt).toLocaleDateString()}</span>
                        <span>{doc.blocks.length} blocks</span>
                      </div>
                    </Link>
                  ))}
                  
                  {/* Add New Note Card */}
                  <button
                    onClick={handleCreateDocument}
                    className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2">
                      <Plus className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Create New Note</span>
                  </button>
                </div>
              )}
            </>
          )}
          
          {/* Chat Mode */}
          {activeMode === 'chat' && (
            <div className="max-w-3xl mx-auto">
              <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <MessageSquare className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">Chat Mode</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  Open a note and use the chat assistant icon to chat with your notes
                </p>
                <button
                  onClick={handleCreateDocument}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Create New Note
                </button>
              </div>
            </div>
          )}
        </main>
        
        {/* Footer */}
        <footer className="py-6 px-4 border-t border-gray-200 dark:border-gray-800">
          <div className="max-w-7xl mx-auto text-center text-sm text-gray-500 dark:text-gray-400">
            <p>NotesAI - Smart note taking with AI assistance</p>
          </div>
        </footer>
      </div>
    </ErrorBoundary>
  );
}