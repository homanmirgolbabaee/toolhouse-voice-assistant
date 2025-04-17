// components/MessageFormatter.tsx
import React, { useState } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { Volume2 } from 'lucide-react';
import { useTTS } from '@/contexts/TTSContext';
import { generateSpeech, playAudio } from '@/utils/elevenLabsTTS';

interface MessageFormatterProps {
  content: string;
  className?: string;
}

const MessageFormatter: React.FC<MessageFormatterProps> = ({ content, className = '' }) => {
  const { apiKey, selectedVoice, isTTSEnabled } = useTTS();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Configure marked for GitHub-like rendering
  marked.setOptions({
    gfm: true, // GitHub Flavored Markdown
    breaks: true, // Line breaks are treated as <br>
    headerIds: false, // Don't add IDs to headers
    mangle: false, // Don't mangle header IDs
  });

  // Process the content through marked to convert markdown to HTML
  const processContent = () => {
    if (!content) return '';
    
    try {
      // Convert markdown to HTML
      const rawHtml = marked.parse(content);
      
      // Sanitize the HTML to prevent XSS attacks
      const sanitizedHtml = DOMPurify.sanitize(rawHtml);
      
      return sanitizedHtml;
    } catch (error) {
      console.error('Error parsing markdown:', error);
      return content; // Fallback to raw content if parsing fails
    }
  };

  // Handle text-to-speech
  const handleTTS = async () => {
    if (!apiKey || !content || isPlaying || isLoading) return;

    try {
      setIsLoading(true);
      
      // Extract plain text from content (removing markdown)
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = processContent();
      const plainText = tempDiv.textContent || '';
      
      // Generate speech using ElevenLabs
      const audioBlob = await generateSpeech({
        text: plainText,
        voiceId: selectedVoice.id,
        apiKey
      });
      
      // Play the audio
      const audio = playAudio(audioBlob);
      
      // Handle audio events
      setIsPlaying(true);
      audio.onended = () => setIsPlaying(false);
      audio.onpause = () => setIsPlaying(false);
      audio.onerror = () => {
        setIsPlaying(false);
        setIsLoading(false);
      };
    } catch (error) {
      console.error('Error generating speech:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`markdown-content relative group ${className}`}>
      <div dangerouslySetInnerHTML={{ __html: processContent() }} />
      
      {/* TTS Button - only show if TTS is enabled and there's an API key */}
      {isTTSEnabled && apiKey && (
        <button 
          onClick={handleTTS}
          disabled={isLoading || isPlaying}
          className={`absolute top-0 right-0 p-1.5 rounded-full bg-gray-100 dark:bg-gray-800 opacity-0 group-hover:opacity-100 transition-opacity ${
            isLoading || isPlaying ? 'cursor-not-allowed' : 'hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
          title={isPlaying ? "Playing..." : "Read with ElevenLabs"}
        >
          <Volume2 size={14} className={isPlaying ? "text-blue-500 animate-pulse" : "text-gray-600 dark:text-gray-300"} />
        </button>
      )}
    </div>
  );
};

export default MessageFormatter;