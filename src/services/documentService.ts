// services/documentService.ts
import { v4 as uuidv4 } from 'uuid';
import { Document, Block } from '@/models/document';
import logger from '@/utils/logger';
import performanceUtils from '@/utils/performance';

// Keys for localStorage
const DOCUMENT_LIST_KEY = 'notesai_documents';
const DOCUMENT_PREFIX = 'notesai_doc_';
const USER_SETTINGS_KEY = 'notesai_settings';

// Document cache to reduce localStorage operations
let documentCache: Map<string, Document> = new Map();
let documentIdListCache: string[] | null = null;

// Safe localStorage access wrapper
const safeLocalStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined') {
        return localStorage.getItem(key);
      }
      return null;
    } catch (error) {
      logger.error('document', `Error reading from localStorage: ${key}`, error);
      return null;
    }
  },
  
  setItem: (key: string, value: string): boolean => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(key, value);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('document', `Error writing to localStorage: ${key}`, error);
      return false;
    }
  },
  
  removeItem: (key: string): boolean => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(key);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('document', `Error removing from localStorage: ${key}`, error);
      return false;
    }
  }
};

/**
 * Initialize the document service
 */
export const initDocumentService = (): void => {
  try {
    // Make sure we're running in browser
    if (typeof window === 'undefined') {
      return;
    }
    
    // Test localStorage access
    safeLocalStorage.setItem('notesai_test', 'test');
    safeLocalStorage.removeItem('notesai_test');
    
    // Pre-load document IDs on init for better performance
    getDocumentIds();
    
    // Create a default document if no documents exist
    setTimeout(async () => {
      try {
        const docs = await getAllDocuments();
        if (docs.length === 0) {
          await createDocument({
            title: "Welcome to NotesAI",
            blocks: [
              { 
                id: uuidv4(), 
                type: "heading", 
                content: "Welcome to NotesAI!",
                properties: { level: 1 }
              },
              { 
                id: uuidv4(), 
                type: "text", 
                content: "This is your first note. NotesAI is a powerful note-taking app with AI capabilities." 
              },
              { 
                id: uuidv4(), 
                type: "text", 
                content: "Getting started:" 
              },
              { 
                id: uuidv4(), 
                type: "list", 
                content: "Type '/' to access the command menu" 
              },
              { 
                id: uuidv4(), 
                type: "list", 
                content: "Press Enter to create a new block" 
              },
              { 
                id: uuidv4(), 
                type: "list", 
                content: "Use the chat assistant to ask questions or get help" 
              },
              { 
                id: uuidv4(), 
                type: "text", 
                content: "Enjoy taking notes with AI assistance!" 
              },
            ]
          });
        }
      } catch (error) {
        logger.error('document', 'Error initializing documents', error);
      }
    }, 100);
  } catch (error) {
    logger.error('document', 'Error initializing document service', error);
  }
};

// Helper to get all document IDs
const getDocumentIds = (): string[] => {
  // Return from cache if available
  if (documentIdListCache) {
    return [...documentIdListCache];
  }
  
  try {
    const stored = safeLocalStorage.getItem(DOCUMENT_LIST_KEY);
    const ids = stored ? JSON.parse(stored) : [];
    documentIdListCache = ids;
    return [...ids];
  } catch (error) {
    logger.error('document', 'Error loading document IDs', error);
    documentIdListCache = [];
    return [];
  }
};

// Helper to save document IDs
const saveDocumentIds = (ids: string[]): void => {
  try {
    documentIdListCache = [...ids];
    safeLocalStorage.setItem(DOCUMENT_LIST_KEY, JSON.stringify(ids));
  } catch (error) {
    logger.error('document', 'Error saving document IDs', error);
  }
};

// Get all documents
export const getAllDocuments = async (): Promise<Document[]> => {
  performanceUtils.start('load-all-documents');
  try {
    const ids = getDocumentIds();
    const documents: Document[] = [];
    
    for (const id of ids) {
      try {
        const doc = await getDocument(id);
        documents.push(doc);
      } catch (error) {
        logger.warn('document', `Skipping invalid document ${id}`, error);
        // Remove invalid document ID from the list
        saveDocumentIds(ids.filter(docId => docId !== id));
      }
    }
    
    // Sort by updated date, newest first
    documents.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    
    performanceUtils.end('load-all-documents');
    return documents;
  } catch (error) {
    performanceUtils.end('load-all-documents');
    logger.error('document', 'Error getting all documents', error);
    throw new Error('Failed to load documents');
  }
};

// Get a single document by ID
export const getDocument = async (id: string): Promise<Document> => {
  performanceUtils.start(`load-document-${id}`);
  try {
    // Check cache first
    if (documentCache.has(id)) {
      performanceUtils.end(`load-document-${id}`);
      return documentCache.get(id)!;
    }
    
    const docJson = safeLocalStorage.getItem(`${DOCUMENT_PREFIX}${id}`);
    if (!docJson) {
      throw new Error(`Document not found: ${id}`);
    }
    
    const doc = JSON.parse(docJson) as Document;
    // Convert string dates back to Date objects
    doc.createdAt = new Date(doc.createdAt);
    doc.updatedAt = new Date(doc.updatedAt);
    
    // Update cache
    documentCache.set(id, doc);
    
    performanceUtils.end(`load-document-${id}`);
    return doc;
  } catch (error) {
    performanceUtils.end(`load-document-${id}`);
    logger.error('document', `Error getting document ${id}`, error);
    throw new Error(`Failed to load document: ${id}`);
  }
};

// Create a new document
export const createDocument = async (data: Partial<Document>): Promise<Document> => {
  performanceUtils.start('create-document');
  try {
    const now = new Date();
    const id = uuidv4();
    
    const newDocument: Document = {
      id,
      title: data.title || 'Untitled',
      blocks: data.blocks || [{ id: uuidv4(), type: 'text', content: '' }],
      createdAt: now,
      updatedAt: now,
      metadata: data.metadata || {}
    };
    
    // Save the document
    const saved = safeLocalStorage.setItem(`${DOCUMENT_PREFIX}${id}`, JSON.stringify(newDocument));
    
    if (!saved) {
      throw new Error('Failed to save document to storage');
    }
    
    // Update the document list
    const ids = getDocumentIds();
    ids.unshift(id); // Add to the beginning
    saveDocumentIds(ids);
    
    // Update cache
    documentCache.set(id, newDocument);
    
    logger.info('document', `Created document: ${newDocument.title}`, { id });
    performanceUtils.end('create-document');
    return newDocument;
  } catch (error) {
    performanceUtils.end('create-document');
    logger.error('document', 'Error creating document', error);
    throw new Error('Failed to create document');
  }
};

// Update an existing document
export const updateDocument = async (document: Document): Promise<Document> => {
  performanceUtils.start(`update-document-${document.id}`);
  try {
    // Make sure the document exists
    if (!documentCache.has(document.id) && !safeLocalStorage.getItem(`${DOCUMENT_PREFIX}${document.id}`)) {
      throw new Error(`Document not found: ${document.id}`);
    }
    
    // Update the timestamp
    document.updatedAt = new Date();
    
    // Save the updated document
    const saved = safeLocalStorage.setItem(`${DOCUMENT_PREFIX}${document.id}`, JSON.stringify(document));
    
    if (!saved) {
      throw new Error('Failed to save document to storage');
    }
    
    // Update cache
    documentCache.set(document.id, document);
    
    // Update document order if needed
    const ids = getDocumentIds();
    if (ids[0] !== document.id) {
      // Move the document to the top of the list
      const newIds = [document.id, ...ids.filter(id => id !== document.id)];
      saveDocumentIds(newIds);
    }
    
    logger.debug('document', `Updated document: ${document.title}`, { id: document.id });
    performanceUtils.end(`update-document-${document.id}`);
    return document;
  } catch (error) {
    performanceUtils.end(`update-document-${document.id}`);
    logger.error('document', `Error updating document ${document.id}`, error);
    throw new Error(`Failed to update document: ${document.id}`);
  }
};

// Delete a document
export const deleteDocument = async (id: string): Promise<void> => {
  performanceUtils.start(`delete-document-${id}`);
  try {
    // Remove from localStorage
    safeLocalStorage.removeItem(`${DOCUMENT_PREFIX}${id}`);
    
    // Update the document list
    const ids = getDocumentIds();
    const updatedIds = ids.filter(docId => docId !== id);
    saveDocumentIds(updatedIds);
    
    // Remove from cache
    documentCache.delete(id);
    
    logger.info('document', `Deleted document: ${id}`);
    performanceUtils.end(`delete-document-${id}`);
  } catch (error) {
    performanceUtils.end(`delete-document-${id}`);
    logger.error('document', `Error deleting document ${id}`, error);
    throw new Error(`Failed to delete document: ${id}`);
  }
};

// Export all documents (for backup)
export const exportAllDocuments = async (): Promise<string> => {
  try {
    const documents = await getAllDocuments();
    const exportData = {
      version: 1,
      timestamp: new Date().toISOString(),
      documents
    };
    
    return JSON.stringify(exportData, null, 2);
  } catch (error) {
    logger.error('document', 'Error exporting documents', error);
    throw new Error('Failed to export documents');
  }
};

// Import documents (from backup)
export const importDocuments = async (jsonData: string): Promise<number> => {
  try {
    const importData = JSON.parse(jsonData);
    
    if (!importData.documents || !Array.isArray(importData.documents)) {
      throw new Error('Invalid import data format');
    }
    
    const imported = await Promise.all(
      importData.documents.map(async (doc: any) => {
        try {
          // Generate a new ID to avoid conflicts
          const newDoc = {
            ...doc,
            id: uuidv4(),
            title: doc.title ? `${doc.title} (Imported)` : 'Imported Document'
          };
          
          await createDocument(newDoc);
          return true;
        } catch (err) {
          logger.error('document', 'Error importing document', { error: err, doc });
          return false;
        }
      })
    );
    
    // Return count of successfully imported documents
    return imported.filter(success => success).length;
  } catch (error) {
    logger.error('document', 'Error importing documents', error);
    throw new Error('Failed to import documents');
  }
};

// Get user settings
export const getUserSettings = (): any => {
  try {
    const settingsJson = safeLocalStorage.getItem(USER_SETTINGS_KEY);
    return settingsJson ? JSON.parse(settingsJson) : {};
  } catch (error) {
    logger.error('settings', 'Error getting user settings', error);
    return {};
  }
};

// Update user settings
export const updateUserSettings = (settings: any): void => {
  try {
    safeLocalStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    logger.error('settings', 'Error updating user settings', error);
  }
};

// Clear document cache
export const clearCache = (): void => {
  documentCache.clear();
  documentIdListCache = null;
};

// Search documents
export const searchDocuments = async (query: string): Promise<Document[]> => {
  if (!query || query.trim() === '') {
    return getAllDocuments();
  }
  
  try {
    const documents = await getAllDocuments();
    const lowercaseQuery = query.toLowerCase();
    
    return documents.filter(doc => {
      // Search in title
      if (doc.title.toLowerCase().includes(lowercaseQuery)) {
        return true;
      }
      
      // Search in content
      return doc.blocks.some(block => 
        block.content.toLowerCase().includes(lowercaseQuery)
      );
    });
  } catch (error) {
    logger.error('document', 'Error searching documents', error);
    throw new Error('Failed to search documents');
  }
};

// Initialize the service
if (typeof window !== 'undefined') {
  // Only initialize on client side
  initDocumentService();
}