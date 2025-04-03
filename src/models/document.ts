// models/document.ts
export type BlockType = 
  | 'text' 
  | 'heading' 
  | 'list' 
  | 'code' 
  | 'todo' 
  | 'audio';

export interface Block {
  id: string;
  type: BlockType;
  content: string;
  properties?: {
    // For heading blocks
    level?: 1 | 2 | 3;
    
    // For list blocks
    ordered?: boolean;
    
    // For code blocks
    language?: string;
    
    // For todo blocks
    checked?: boolean;
    
    // For audio blocks
    audioUrl?: string;
    duration?: number;
  };
}

export interface Document {
  id: string;
  title: string;
  blocks: Block[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    tags?: string[];
    favorite?: boolean;
    color?: string;
    emoji?: string;
    chatHistory?: Array<{ role: string; content: string }>;
    [key: string]: any;
  };
}