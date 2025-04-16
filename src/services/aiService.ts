// src/services/aiService.ts

import logger from '@/utils/logger';

export interface TranscriptionResult {
  text: string;
  requestId: string;
  processingTime: number;
}

export interface ProcessResult {
  response: string;
  requestId: string;
  processingTime: number;
}

/**
 * Transcribe an audio blob to text
 */
export async function transcribeAudio(audioBlob: Blob): Promise<TranscriptionResult> {
  try {
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.webm");
    
    logger.debug('api', 'Sending audio for transcription', { size: audioBlob.size });
    
    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      logger.error('api', 'Transcription failed', { 
        status: response.status,
        error: errorData
      });
      throw new Error(`Transcription failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    logger.debug('api', 'Transcription completed', { 
      textLength: result.text?.length || 0,
      processingTime: result.processingTime
    });
    
    return result;
  } catch (error) {
    logger.error('api', 'Error in transcribeAudio:', error);
    throw error;
  }
}

/**
 * Process text with AI
 */
export async function processText(text: string, documentContext?: string): Promise<ProcessResult> {
  try {
    logger.debug('api', 'Processing text with AI', { 
      textLength: text.length,
      hasContext: !!documentContext
    });
    
    const response = await fetch("/api/process", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ 
        text,
        documentContext
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      logger.error('api', 'AI processing failed', { 
        status: response.status,
        error: errorData
      });
      throw new Error(`Processing failed: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    logger.debug('api', 'AI processing completed', { 
      responseLength: result.response?.length || 0,
      processingTime: result.processingTime
    });
    
    return result;
  } catch (error) {
    logger.error('api', 'Error in processText:', error);
    throw error;
  }
}

export default {
  transcribeAudio,
  processText
};