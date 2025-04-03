// components/Sidebar.tsx
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  ChevronDown, 
  ChevronRight, 
  ChevronLeft,
  File, 
  Folder, 
  Plus, 
  Search, 
  Settings 
} from "lucide-react";
import logger from "@/utils/logger";
import { Document } from "@/models/document";
import { getAllDocuments, createDocument } from "@/services/documentService";

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
}

export default function Sidebar({ isCollapsed = false, onToggle }: SidebarProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    "recent": true,
    "workspace": true
  });
  const pathname = usePathname();
  
  useEffect(() => {
    const loadDocuments = async () => {
      try {
        setIsLoading(true);
        const docs = await getAllDocuments();
        setDocuments(docs);
        logger.debug('sidebar', `Loaded ${docs.length} documents`);
      } catch (error) {
        logger.error('sidebar', 'Failed to load documents', { error });
      } finally {
        setIsLoading(false);
      }
    };
    
    loadDocuments();
  }, []);

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  const handleCreateDocument = async () => {
    try {
      const newDoc = await createDocument({
        title: "Untitled",
        blocks: [{ id: "1", type: "text", content: "" }]
      });
      
      setDocuments(prev => [newDoc, ...prev]);
      logger.info('sidebar', 'Created new document', { documentId: newDoc.id });
      
      // Navigate to the new document
      window.location.href = `/documents/${newDoc.id}`;
    } catch (error) {
      logger.error('sidebar', 'Failed to create document', { error });
    }
  };

  const filteredDocuments = searchQuery
    ? documents.filter(doc => 
        doc.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : documents;

  if (isCollapsed) {
    return (
      <div className="w-14 h-screen bg-gray-100 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col py-4">
        <button 
          onClick={onToggle} 
          className="mb-6 mx-auto text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ChevronRight size={20} />
        </button>
        <button 
          onClick={handleCreateDocument}
          className="mx-auto p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 mb-4"
          title="New Document"
        >
          <Plus size={16} />
        </button>
        <div className="flex-1 overflow-auto">
          {/* Collapsed document list would go here */}
        </div>
        <button className="mx-auto mt-auto p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
          <Settings size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="w-64 h-screen bg-gray-100 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <h2 className="font-semibold text-lg">Notes</h2>
        <button 
          onClick={onToggle} 
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ChevronLeft size={20} />
        </button>
      </div>
      
      {/* Search Bar */}
      <div className="p-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      
      {/* New Document Button */}
      <div className="p-3">
        <button 
          onClick={handleCreateDocument}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
        >
          <Plus size={16} />
          <span>New Document</span>
        </button>
      </div>
      
      {/* Document List */}
      <div className="flex-1 overflow-auto p-2">
        {isLoading ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            Loading documents...
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            {searchQuery ? "No documents match your search" : "No documents yet"}
          </div>
        ) : (
          <div className="space-y-1">
            {/* Recent Documents Section */}
            <div>
              <button 
                onClick={() => toggleFolder("recent")}
                className="flex items-center w-full p-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-md"
              >
                {expandedFolders["recent"] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <Folder size={16} className="ml-1 mr-2 text-gray-500" />
                <span>Recent</span>
              </button>
              
              {expandedFolders["recent"] && (
                <div className="ml-5 mt-1 space-y-1">
                  {filteredDocuments.slice(0, 5).map(doc => (
                    <Link 
                      key={doc.id}
                      href={`/documents/${doc.id}`}
                      className={`flex items-center w-full p-2 text-sm rounded-md ${
                        pathname === `/documents/${doc.id}`
                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
                      }`}
                    >
                      <File size={14} className="mr-2 text-gray-500" />
                      <span className="truncate">{doc.title || "Untitled"}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
            
            {/* All Documents */}
            <div>
              <button 
                onClick={() => toggleFolder("workspace")}
                className="flex items-center w-full p-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-md"
              >
                {expandedFolders["workspace"] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <Folder size={16} className="ml-1 mr-2 text-gray-500" />
                <span>Workspace</span>
              </button>
              
              {expandedFolders["workspace"] && (
                <div className="ml-5 mt-1 space-y-1">
                  {filteredDocuments.map(doc => (
                    <Link 
                      key={doc.id}
                      href={`/documents/${doc.id}`}
                      className={`flex items-center w-full p-2 text-sm rounded-md ${
                        pathname === `/documents/${doc.id}`
                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800"
                      }`}
                    >
                      <File size={14} className="mr-2 text-gray-500" />
                      <span className="truncate">{doc.title || "Untitled"}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Sidebar Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between">
        <button className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 p-2">
          <Settings size={18} />
        </button>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          <span>John Doe</span>
        </div>
      </div>
    </div>
  );
}