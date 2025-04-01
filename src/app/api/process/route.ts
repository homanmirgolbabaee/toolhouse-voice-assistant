import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { Toolhouse } from "@toolhouseai/sdk";
import logger from "@/utils/logger";
import performanceUtils from "@/utils/performance";

// Initialize the clients with the same credentials as your Python app
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const toolhouse = new Toolhouse({
  apiKey: process.env.TOOLHOUSE_API_KEY,
  metadata: {
    "id": "user-id",
    "timezone": "0"
  }
});

// Define the OpenAI model - same as Python implementation
const MODEL = 'gpt-4o-mini';

// Helper to generate a unique request ID
const generateRequestId = () => {
  return `req-${Math.random().toString(36).substring(2, 9)}`;
};

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  logger.info("api", `Processing request ${requestId} started`);
  
  try {
    // Parse the JSON request body
    const body = await request.json();
    const { text } = body;

    if (!text) {
      logger.warn("api", `Request ${requestId} missing text field`, { body });
      return NextResponse.json(
        { error: "No text provided", requestId },
        { status: 400 }
      );
    }

    logger.debug("api", `Processing text with Toolhouse for request ${requestId}:`, { 
      text: text.length > 100 ? `${text.substring(0, 100)}...` : text,
      textLength: text.length 
    });

    // Following the EXACT pattern from your Python code
    const messages = [{
      role: "user",
      content: text
    }];

    // First call to get tool calls
    logger.debug("api", `Getting tools from Toolhouse for request ${requestId}...`);
    performanceUtils.start(`toolhouse-get-tools-${requestId}`);
    
    let tools;
    try {
      tools = await toolhouse.getTools();
      performanceUtils.end(`toolhouse-get-tools-${requestId}`);
      logger.debug("api", `Got ${tools.length} tools from Toolhouse for request ${requestId}`);
    } catch (error) {
      performanceUtils.end(`toolhouse-get-tools-${requestId}`);
      logger.error("api", `Error getting tools from Toolhouse for request ${requestId}:`, error);
      throw new Error(`Failed to get tools: ${(error as Error).message}`);
    }
    
    logger.debug("api", `Making initial OpenAI call with tools for request ${requestId}...`);
    performanceUtils.start(`openai-initial-${requestId}`);
    
    let response;
    try {
      response = await openai.chat.completions.create({
        model: MODEL,
        messages: messages,
        tools: tools
      });
      performanceUtils.end(`openai-initial-${requestId}`);
      logger.debug("api", `Initial OpenAI response received for request ${requestId}`);
    } catch (error) {
      performanceUtils.end(`openai-initial-${requestId}`);
      logger.error("api", `Error in initial OpenAI call for request ${requestId}:`, error);
      throw new Error(`OpenAI call failed: ${(error as Error).message}`);
    }

    // Run the tools and get updated messages
    logger.debug("api", `Running tools for request ${requestId}...`);
    performanceUtils.start(`toolhouse-run-tools-${requestId}`);
    
    let toolMessages;
    try {
      toolMessages = await toolhouse.runTools(response);
      performanceUtils.end(`toolhouse-run-tools-${requestId}`);
      logger.debug("api", `Toolhouse tools executed for request ${requestId}, got ${toolMessages.length} tool messages`);
    } catch (error) {
      performanceUtils.end(`toolhouse-run-tools-${requestId}`);
      logger.error("api", `Error running Toolhouse tools for request ${requestId}:`, error);
      throw new Error(`Failed to run tools: ${(error as Error).message}`);
    }

    // Add tool messages to our messages list
    const newMessages = [...messages, ...toolMessages];
    
    logger.debug("api", `Making final OpenAI call with tool results for request ${requestId}...`);
    performanceUtils.start(`openai-final-${requestId}`);
    
    let finalResponse;
    try {
      // Get final response with tool results
      finalResponse = await openai.chat.completions.create({
        model: MODEL,
        messages: newMessages,
        tools: tools
      });
      performanceUtils.end(`openai-final-${requestId}`);
      logger.debug("api", `Final OpenAI response received for request ${requestId}`);
    } catch (error) {
      performanceUtils.end(`openai-final-${requestId}`);
      logger.error("api", `Error in final OpenAI call for request ${requestId}:`, error);
      throw new Error(`Final OpenAI call failed: ${(error as Error).message}`);
    }

    // Get response text
    const aiText = finalResponse.choices[0].message.content;
    logger.debug("api", `Final response for request ${requestId}:`, { 
      response: aiText?.substring(0, 100) + (aiText && aiText.length > 100 ? '...' : ''),
      responseLength: aiText?.length || 0
    });

    const totalDuration = Date.now() - startTime;
    logger.info("api", `Processing request ${requestId} completed in ${totalDuration.toFixed(2)}ms`);

    // Return the processed response
    return NextResponse.json({ 
      response: aiText || "I couldn't generate a response.",
      requestId,
      processingTime: totalDuration
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    const totalDuration = Date.now() - startTime;
    
    logger.error("api", `Processing request ${requestId} failed after ${totalDuration.toFixed(2)}ms:`, {
      error: errorMessage,
      stack: (error as Error).stack
    });
    
    return NextResponse.json(
      { 
        error: `Processing failed: ${errorMessage}`,
        requestId,
        processingTime: totalDuration
      },
      { status: 500 }
    );
  }
}