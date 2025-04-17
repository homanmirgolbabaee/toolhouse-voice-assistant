// src/utils/elevenLabsTTS.ts

/**
 * Utility for interacting with the ElevenLabs TTS API
 */

// ElevenLabs API configuration
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Voice options
export interface Voice {
  id: string;
  name: string;
  category?: string;
}

// Default voices - Updated with current ElevenLabs voices
export const ELEVENLABS_VOICES: Voice[] = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", category: "premade" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", category: "premade" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", category: "premade" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni", category: "premade" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", category: "premade" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", category: "premade" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", category: "premade" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", category: "premade" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", category: "premade" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "Daniel", category: "premade" },
];

// TTS Request Options
export interface TTSOptions {
  text: string;
  voiceId: string;
  apiKey: string;
  stability?: number;
  similarityBoost?: number;
  modelId?: string;
}

/**
 * Get available ElevenLabs voices
 */
export async function getVoices(apiKey: string): Promise<Voice[]> {
  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch voices: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.voices || [];
  } catch (error) {
    console.error('Error fetching ElevenLabs voices:', error);
    // Return default voices as fallback
    return ELEVENLABS_VOICES;
  }
}

/**
 * Generate speech using ElevenLabs TTS API
 */
export async function generateSpeech(options: TTSOptions): Promise<Blob> {
  const { 
    text, 
    voiceId, 
    apiKey, 
    stability = 0.5, 
    similarityBoost = 0.75, 
    modelId = 'eleven_multilingual_v2' 
  } = options;

  if (!apiKey) {
    throw new Error('ElevenLabs API key is required');
  }
  
  // Verify text length - ElevenLabs has limits
  if (text.length > 5000) {
    console.warn(`Text length (${text.length} chars) exceeds recommended limit of 5000 chars`);
  }

  try {
    const response = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability,
          similarity_boost: similarityBoost
        }
      })
    });

    if (!response.ok) {
      let errorMessage = `Failed to generate speech: ${response.status} ${response.statusText}`;
      
      try {
        // Try to parse the error response for more details
        const errorData = await response.json();
        errorMessage += ` - ${JSON.stringify(errorData)}`;
        
        // Check for specific error types
        if (errorData.detail?.status === 'max_character_limit_exceeded') {
          errorMessage = `Text exceeds ElevenLabs character limit. Please select a shorter text (under 5000 characters)`;
        }
      } catch (e) {
        // If we can't parse the error as JSON, just use the status
      }
      
      throw new Error(errorMessage);
    }

    // The response is an audio blob
    const audioBlob = await response.blob();
    return audioBlob;
  } catch (error) {
    console.error('Error generating speech with ElevenLabs:', error);
    throw error;
  }
}

// Utility function to play TTS audio
export function playAudio(audioBlob: Blob): HTMLAudioElement {
  const audio = new Audio();
  audio.src = URL.createObjectURL(audioBlob);
  
  // Add error handler for debugging
  audio.onerror = (e) => {
    console.error('Error playing audio:', e);
  };
  
  // Play the audio
  audio.play().catch(e => {
    console.error('Failed to play audio:', e);
  });
  
  // Clean up URL object when done
  audio.onended = () => {
    URL.revokeObjectURL(audio.src);
  };
  
  return audio;
}

// Default export
export default {
  getVoices,
  generateSpeech,
  playAudio,
  ELEVENLABS_VOICES
};