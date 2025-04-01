import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import os from "os";
import logger from "@/utils/logger";
import performanceUtils from "@/utils/performance";

// Simple OpenAI client - using directly provided API key for reliability
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Helper to generate a unique request ID
const generateRequestId = () => {
  return `trans-${Math.random().toString(36).substring(2, 9)}`;
};

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  logger.info("api", `Transcription request ${requestId} started`);
  
  try {
    // Get the audio file from the request
    const formData = await request.formData();
    const audioFile = formData.get("file") as File;
    
    if (!audioFile) {
      logger.warn("api", `Transcription request ${requestId} missing audio file`);
      return NextResponse.json(
        { error: "No audio file provided", requestId },
        { status: 400 }
      );
    }
    
    logger.debug("api", `Audio file received for request ${requestId}:`, { 
      filename: audioFile.name,
      type: audioFile.type,
      size: `${audioFile.size} bytes`
    });
    
    // Save to a temporary file - OpenAI works better with files
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    const tempFilePath = path.join(os.tmpdir(), `recording-${requestId}.webm`);
    
    try {
      fs.writeFileSync(tempFilePath, audioBuffer);
      logger.debug("api", `Audio saved to temporary file for request ${requestId}:`, { 
        path: tempFilePath, 
        size: audioBuffer.length 
      });
    } catch (error) {
      logger.error("api", `Error saving audio file for request ${requestId}:`, error);
      throw new Error(`Could not save audio file: ${(error as Error).message}`);
    }
    
    try {
      // Transcribe using OpenAI's Whisper model
      logger.debug("api", `Calling OpenAI transcription API for request ${requestId}...`);
      performanceUtils.start(`whisper-transcription-${requestId}`);
      
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: "whisper-1",
        language: "en", // Forcing English for better results
      });
      
      performanceUtils.end(`whisper-transcription-${requestId}`);
      
      const textLength = transcription.text.length;
      logger.debug("api", `Transcription successful for request ${requestId}:`, { 
        textLength,
        text: textLength > 100 ? `${transcription.text.substring(0, 100)}...` : transcription.text
      });
      
      // Clean up temp file
      try {
        fs.unlinkSync(tempFilePath);
        logger.debug("api", `Temporary file deleted for request ${requestId}`);
      } catch (e) {
        logger.warn("api", `Error deleting temp file for request ${requestId}:`, e);
      }
      
      const totalDuration = Date.now() - startTime;
      logger.info("api", `Transcription request ${requestId} completed in ${totalDuration.toFixed(2)}ms`);
      
      // Return the transcription text
      return NextResponse.json({ 
        text: transcription.text,
        requestId,
        processingTime: totalDuration
      });
    } catch (error) {
      performanceUtils.end(`whisper-transcription-${requestId}`);
      logger.error("api", `OpenAI transcription error for request ${requestId}:`, error);
      
      // Clean up temp file even on error
      try {
        fs.unlinkSync(tempFilePath);
        logger.debug("api", `Temporary file deleted after error for request ${requestId}`);
      } catch (e) {
        logger.warn("api", `Error deleting temp file after error for request ${requestId}:`, e);
      }
      
      const totalDuration = Date.now() - startTime;
      return NextResponse.json({ 
        error: "Transcription failed", 
        details: (error as Error).message,
        requestId,
        processingTime: totalDuration
      }, { status: 500 });
    }
  } catch (error) {
    const errorMessage = (error as Error).message;
    const totalDuration = Date.now() - startTime;
    
    logger.error("api", `Transcription request ${requestId} failed after ${totalDuration.toFixed(2)}ms:`, {
      error: errorMessage,
      stack: (error as Error).stack
    });
    
    return NextResponse.json({ 
      error: "Server error processing audio", 
      details: errorMessage,
      requestId,
      processingTime: totalDuration
    }, { status: 500 });
  }
}