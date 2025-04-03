// services/documentService.ts
import { v4 as uuidv4 } from 'uuid';
import { Document, Block } from '@/models/document';
import logger from '@/utils/logger';

// Keys for localStorage
const DOCUMENT_LIST_KEY = 'notesai_documents';
const DOCUMENT_PREFIX = 'notesai_doc_';

// Helper to get all document IDs
const getDocumentIds = (): string[] => {
  try {
    const stored = localStorage.getItem(DOCUMENT_LIST_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    logger.error('document', 'Error loading document IDs', { error });
    return [];
  }
};

// Helper to save document IDs
const saveDocumentIds = (ids: string[]): void => {
  try {
    localStorage.setItem(DOCUMENT_LIST_KEY, JSON.stringify(ids));
  } catch (error) {
    logger.error('document', 'Error saving document IDs', { error });
  }
};

// Get all documents
export const getAllDocuments = async (): Promise<Document[]> => {
  try {
    const ids = getDocumentIds();
    const documents: Document[] = [];
    
    for (const id of ids) {
      try {
        const docJson = localStorage.getItem(`${DOCUMENT_PREFIX}${id}`);
        if (docJson) {
          const doc = JSON.parse(docJson) as Document;
          // Convert string dates back to Date objects
          doc.createdAt = new Date(doc.createdAt);
          doc.updatedAt = new Date(doc.updatedAt);
          documents.push(doc);
        }
      } catch (error) {
        logger.error('document', `Error parsing document ${id}`, { error });
      }
    }
    
    return documents;
  } catch (error) {
    logger.error('document', 'Error getting all documents', { error });
    throw new Error('Failed to load documents');
  }
};

// Get a single document by ID
export const getDocument = async (id: string): Promise<Document> => {
  try {
    const docJson = localStorage.getItem(`${DOCUMENT_PREFIX}${id}`);
    if (!docJson) {
      throw new Error(`Document not found: ${id}`);
    }
    
    const doc = JSON.parse(docJson) as Document;
    // Convert string dates back to Date objects
    doc.createdAt = new Date(doc.createdAt);
    doc.updatedAt = new Date(doc.updatedAt);
    
    return doc;
  } catch (error) {
    logger.error('document', `Error getting document ${id}`, { error });
    throw new Error(`Failed to load document: ${id}`);
  }
};

// Create a new document
export const createDocument = async (data: Partial<Document>): Promise<Document> => {
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
    localStorage.setItem(`${DOCUMENT_PREFIX}${id}`, JSON.stringify(newDocument));
    
    // Update the document list
    const ids = getDocumentIds();
    ids.unshift(id); // Add to the beginning
    saveDocumentIds(ids);
    
    logger.info('document', `Created document: ${newDocument.title}`, { id });
    return newDocument;
  } catch (error) {
    logger.error('document', 'Error creating document', { error });
    throw new Error('Failed to create document');
  }
};

// Update an existing document
export const updateDocument = async (document: Document): Promise<Document> => {
  try {
    // Make sure the document exists
    const docJson = localStorage.getItem(`${DOCUMENT_PREFIX}${document.id}`);
    if (!docJson) {
      throw new Error(`Document not found: ${document.id}`);
    }
    
    // Update the timestamp
    document.updatedAt = new Date();
    
    // Save the updated document
    localStorage.setItem(`${DOCUMENT_PREFIX}${document.id}`, JSON.stringify(document));
    
    logger.debug('document', `Updated document: ${document.title}`, { id: document.id });
    return document;
  } catch (error) {
    logger.error('document', `Error updating document ${document.id}`, { error });
    throw new Error(`Failed to update document: ${document.id}`);
  }
};

// Delete a document
export const deleteDocument = async (id: string): Promise<void> => {
  try {
    // Remove from localStorage
    localStorage.removeItem(`${DOCUMENT_PREFIX}${id}`);
    
    // Update the document list
    const ids = getDocumentIds();
    const updatedIds = ids.filter(docId => docId !== id);
    saveDocumentIds(updatedIds);
    
    logger.info('document', `Deleted document: ${id}`);
  } catch (error) {
    logger.error('document', `Error deleting document ${id}`, { error });
    throw new Error(`Failed to delete document: ${id}`);
  }
};