// app/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { File, Plus, Search, Mic, MessageSquare, Bot, MoreVertical, Trash2, 
  Copy, FolderPlus, Clock, Star, Download, Upload, X } from "lucide-react"; // Added X icon import
import { Document } from "@/models/document";
import { getAllDocuments, createDocument, deleteDocument, exportAllDocuments, importDocuments } from "@/services/documentService";
import logger from "@/utils/logger";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import ChatMode from '@/components/modes/ChatMode';
import performanceUtils from "@/utils/performance";

export default function HomePage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<'notes' | 'chat'>('notes');
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'title'>('updated');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showDocMenuId, setShowDocMenuId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        setIsLoading(true);
        performanceUtils.start('load-documents-homepage');
        
        const docs = await getAllDocuments();
        setDocuments(docs);
        
        performanceUtils.end('load-documents-homepage');
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

  // Close document menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (docMenuRef.current && !docMenuRef.current.contains(event.target as Node)) {
        setShowDocMenuId(null);
      }
    };

    if (showDocMenuId) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDocMenuId]);

  const handleCreateDocument = async () => {
    try {
      setIsLoading(true);
      
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
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this document? This action cannot be undone.")) {
      return;
    }
    
    try {
      await deleteDocument(id);
      setDocuments(prev => prev.filter(doc => doc.id !== id));
      
      setNotificationMessage("Document deleted");
      setTimeout(() => setNotificationMessage(""), 2000);
      
      logger.info('document', 'Deleted document', { documentId: id });
    } catch (error) {
      setError(`Failed to delete document: ${(error as Error).message}`);
      logger.error('document', 'Error deleting document', { error });
    }
  };

  const handleDuplicateDocument = async (doc: Document) => {
    try {
      const newDoc = await createDocument({
        title: `${doc.title} (Copy)`,
        blocks: doc.blocks,
        metadata: doc.metadata
      });
      
      setDocuments(prev => [newDoc, ...prev]);
      
      setNotificationMessage("Document duplicated");
      setTimeout(() => setNotificationMessage(""), 2000);
      
      logger.info('document', 'Duplicated document', { 
        sourceId: doc.id, 
        newId: newDoc.id 
      });
    } catch (error) {
      setError(`Failed to duplicate document: ${(error as Error).message}`);
      logger.error('document', 'Error duplicating document', { error });
    }
  };

  const handleExportDocuments = async () => {
    try {
      const exportData = await exportAllDocuments();
      
      // Create blob and download
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `notesai-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setNotificationMessage("Documents exported");
      setTimeout(() => setNotificationMessage(""), 2000);
      
      logger.info('document', 'Exported all documents', { 
        count: documents.length 
      });
    } catch (error) {
      setError(`Failed to export documents: ${(error as Error).message}`);
      logger.error('document', 'Error exporting documents', { error });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportDocuments = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      setIsImporting(true);
      
      const fileText = await file.text();
      const importedCount = await importDocuments(fileText);
      
      // Reload documents
      const docs = await getAllDocuments();
      setDocuments(docs);
      
      setNotificationMessage(`${importedCount} document${importedCount !== 1 ? 's' : ''} imported`);
      setTimeout(() => setNotificationMessage(""), 2000);
      
      logger.info('document', 'Imported documents', { count: importedCount });
    } catch (error) {
      setError(`Failed to import documents: ${(error as Error).message}`);
      logger.error('document', 'Error importing documents', { error });
    } finally {
      setIsImporting(false);
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const toggleDocumentSelection = (id: string, selected?: boolean) => {
    setSelectedDocuments(prev => {
      const newSet = new Set(prev);
      
      if (selected !== undefined) {
        if (selected) {
          newSet.add(id);
        } else {
          newSet.delete(id);
        }
      } else {
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
      }
      
      setShowBulkActions(newSet.size > 0);
      return newSet;
    });
  };

  const selectAllDocuments = () => {
    setSelectedDocuments(new Set(documents.map(doc => doc.id)));
    setShowBulkActions(true);
  };

  const clearSelection = () => {
    setSelectedDocuments(new Set());
    setShowBulkActions(false);
  };

  const bulkDeleteDocuments = async () => {
    if (selectedDocuments.size === 0) return;
    
    if (!window.confirm(`Are you sure you want to delete ${selectedDocuments.size} document${selectedDocuments.size !== 1 ? 's' : ''}? This action cannot be undone.`)) {
      return;
    }
    
    try {
      let deletedCount = 0;
      
      for (const id of Array.from(selectedDocuments)) {
        await deleteDocument(id);
        deletedCount++;
      }
      
      // Reload documents
      const docs = await getAllDocuments();
      setDocuments(docs);
      clearSelection();
      
      setNotificationMessage(`${deletedCount} document${deletedCount !== 1 ? 's' : ''} deleted`);
      setTimeout(() => setNotificationMessage(""), 2000);
      
      logger.info('document', 'Bulk deleted documents', { count: deletedCount });
    } catch (error) {
      setError(`Failed to delete documents: ${(error as Error).message}`);
      logger.error('document', 'Error bulk deleting documents', { error });
    }
  };

  const sortDocuments = (docs: Document[]) => {
    return [...docs].sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default: // 'updated'
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });
  };

  const filteredDocuments = searchQuery
    ? documents.filter(doc => {
        const titleMatch = doc.title.toLowerCase().includes(searchQuery.toLowerCase());
        const contentMatch = doc.blocks.some(block => 
          block.content.toLowerCase().includes(searchQuery.toLowerCase())
        );
        return titleMatch || contentMatch;
      })
    : documents;

  // Sort the filtered documents
  const sortedDocuments = sortDocuments(filteredDocuments);

  // Format date for display
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return d.toLocaleDateString();
    }
  };

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
              
              {/* Document Controls */}
              <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">Sort:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="text-sm bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-1"
                    >
                      <option value="updated">Last updated</option>
                      <option value="created">Created date</option>
                      <option value="title">Title</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">View:</span>
                    <div className="flex rounded overflow-hidden border border-gray-300 dark:border-gray-700">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`p-1 ${viewMode === 'grid' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={`p-1 ${viewMode === 'list' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-800'}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleImportClick}
                    className="flex items-center px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  >
                    <Upload size={14} className="mr-1" />
                    Import
                  </button>
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept=".json"
                    onChange={handleImportDocuments}
                    className="hidden"
                  />
                  
                  <button
                    onClick={handleExportDocuments}
                    className="flex items-center px-3 py-1 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                  >
                    <Download size={14} className="mr-1" />
                    Export
                  </button>
                </div>
              </div>
              
              {/* Bulk Actions */}
              {showBulkActions && (
                <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md mb-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedDocuments.size === documents.length}
                      onChange={() => {
                        if (selectedDocuments.size === documents.length) {
                          clearSelection();
                        } else {
                          selectAllDocuments();
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span>{selectedDocuments.size} selected</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={bulkDeleteDocuments}
                      className="flex items-center px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      <Trash2 size={14} className="mr-1" />
                      Delete
                    </button>
                    
                    <button
                      onClick={clearSelection}
                      className="flex items-center px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                    >
                      <X size={14} className="mr-1" />
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              
              {/* Notes Grid/List */}
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
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sortedDocuments.map(doc => (
                    <div 
                      key={doc.id}
                      className="relative group border border-gray-200 dark:border-gray-800 rounded-lg hover:shadow-md transition-shadow bg-white dark:bg-gray-800"
                    >
                      {/* Checkbox for selection */}
                      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <input
                          type="checkbox"
                          checked={selectedDocuments.has(doc.id)}
                          onChange={() => toggleDocumentSelection(doc.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </div>
                      
                      {/* Document Menu */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowDocMenuId(doc.id);
                          }}
                          className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          <MoreVertical size={16} />
                        </button>
                        
                        {showDocMenuId === doc.id && (
                          <div 
                            ref={docMenuRef}
                            className="absolute right-0 top-6 z-10 w-40 bg-white dark:bg-gray-800 shadow-lg rounded-md border border-gray-200 dark:border-gray-700"
                          >
                            <div className="py-1">
                              <Link
                                href={`/documents/${doc.id}`}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                              >
                                <File size={14} className="mr-2" />
                                Open
                              </Link>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDuplicateDocument(doc);
                                  setShowDocMenuId(null);
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                              >
                                <Copy size={14} className="mr-2" />
                                Duplicate
                              </button>
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDeleteDocument(doc.id);
                                  setShowDocMenuId(null);
                                }}
                                className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                              >
                                <Trash2 size={14} className="mr-2" />
                                Delete
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <Link 
                        href={`/documents/${doc.id}`}
                        className="block p-6"
                      >
                        <h3 className="text-lg font-semibold mb-2 truncate">{doc.title || "Untitled"}</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                          {doc.blocks[0]?.content || "No content yet"}
                        </p>
                        <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                          <span>Updated {formatDate(doc.updatedAt)}</span>
                          <span>{doc.blocks.length} blocks</span>
                        </div>
                      </Link>
                    </div>
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
              ) : (
                // List view
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          <input
                            type="checkbox"
                            checked={selectedDocuments.size === documents.length}
                            onChange={() => {
                              if (selectedDocuments.size === documents.length) {
                                clearSelection();
                              } else {
                                selectAllDocuments();
                              }
                            }}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                        </th>
                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Title
                        </th>
                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Updated
                        </th>
                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Created
                        </th>
                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Blocks
                        </th>
                        <th scope="col" className="relative px-3 py-3">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {sortedDocuments.map(doc => (
                        <tr 
                          key={doc.id}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        >
                          <td className="px-3 py-4 whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedDocuments.has(doc.id)}
                              onChange={() => toggleDocumentSelection(doc.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <Link 
                              href={`/documents/${doc.id}`}
                              className="block"
                            >
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {doc.title || "Untitled"}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-xs">
                                {doc.blocks[0]?.content || "No content yet"}
                              </div>
                            </Link>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(doc.updatedAt)}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {formatDate(doc.createdAt)}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {doc.blocks.length}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setShowDocMenuId(doc.id);
                                }}
                                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <MoreVertical size={16} />
                              </button>
                              
                              {showDocMenuId === doc.id && (
                                <div 
                                  ref={docMenuRef}
                                  className="absolute right-0 top-6 z-10 w-40 bg-white dark:bg-gray-800 shadow-lg rounded-md border border-gray-200 dark:border-gray-700"
                                >
                                  <div className="py-1">
                                    <Link
                                      href={`/documents/${doc.id}`}
                                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                                    >
                                      <File size={14} className="mr-2" />
                                      Open
                                    </Link>
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDuplicateDocument(doc);
                                        setShowDocMenuId(null);
                                      }}
                                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                                    >
                                      <Copy size={14} className="mr-2" />
                                      Duplicate
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDeleteDocument(doc.id);
                                        setShowDocMenuId(null);
                                      }}
                                      className="flex items-center w-full px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 text-left"
                                    >
                                      <Trash2 size={14} className="mr-2" />
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
          
          {/* Chat Mode */}
          {activeMode === 'chat' && (
            <div className="max-w-3xl mx-auto">
              <ChatMode />
            </div>
          )}
        </main>
        
        {/* Footer */}
        <footer className="py-6 px-4 border-t border-gray-200 dark:border-gray-800">
          <div className="max-w-7xl mx-auto text-center text-sm text-gray-500 dark:text-gray-400">
            <p>NotesAI - Smart note taking with AI assistance</p>
          </div>
        </footer>
        
        {/* Notification toast */}
        {notificationMessage && (
          <div className="fixed bottom-4 right-4 bg-black/80 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in-out">
            {notificationMessage}
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}