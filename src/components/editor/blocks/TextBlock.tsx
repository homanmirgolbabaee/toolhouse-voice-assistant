// components/editor/blocks/TextBlock.tsx
import React, { useRef, useEffect, useState } from "react";
import { Volume2, Loader2 } from "lucide-react";
import { useTTS } from "@/contexts/TTSContext";
import { generateSpeech, playAudio } from "@/utils/elevenLabsTTS";
import logger from "@/utils/logger";

interface TextBlockProps {
  id: string;
  content: string;
  isActive: boolean;
  onChange: (content: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  readOnly?: boolean;
}

const TextBlock: React.FC<TextBlockProps> = ({
  id,
  content,
  isActive,
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  readOnly = false
}) => {
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const [localContent, setLocalContent] = useState(content);
  const [showTTSButton, setShowTTSButton] = useState(false);
  const [isPlayingTTS, setIsPlayingTTS] = useState(false);
  const [isLoadingTTS, setIsLoadingTTS] = useState(false);
  const previousContentRef = useRef(content);
  const selectionPositionRef = useRef<{ start: number; end: number } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Access TTS context
  const { apiKey, selectedVoice, isTTSEnabled } = useTTS();

  // Only update the content from props when the block is not active
  // This prevents cursor jumps while typing
  useEffect(() => {
    if (!isActive && contentEditableRef.current && content !== previousContentRef.current) {
      contentEditableRef.current.textContent = content;
      setLocalContent(content);
      previousContentRef.current = content;
    }
  }, [content, isActive]);

  // Focus the element when it becomes active
  useEffect(() => {
    if (isActive && contentEditableRef.current) {
      contentEditableRef.current.focus();
      
      // Move cursor to the end only when the block first becomes active
      if (previousContentRef.current !== content) {
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(contentEditableRef.current);
        range.collapse(false); // collapse to the end
        sel?.removeAllRanges();
        sel?.addRange(range);
      } else if (selectionPositionRef.current) {
        // Restore cursor position
        const sel = window.getSelection();
        const range = document.createRange();
        
        // Get the text node (assuming there's only one)
        const textNode = contentEditableRef.current.firstChild || contentEditableRef.current;
        
        if (textNode.nodeType === Node.TEXT_NODE) {
          const start = Math.min(selectionPositionRef.current.start, textNode.textContent?.length || 0);
          const end = Math.min(selectionPositionRef.current.end, textNode.textContent?.length || 0);
          
          range.setStart(textNode, start);
          range.setEnd(textNode, end);
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
        
        selectionPositionRef.current = null;
      }
    }
  }, [isActive, content]);

  // Clean up audio when component unmounts
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Capture the current selection position before handling the input
  const saveSelectionPosition = () => {
    if (contentEditableRef.current) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(contentEditableRef.current);
        preCaretRange.setEnd(range.startContainer, range.startOffset);
        const start = preCaretRange.toString().length;
        
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        const end = preCaretRange.toString().length;
        
        selectionPositionRef.current = { start, end };
      }
    }
  };

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    saveSelectionPosition();
    const newContent = e.currentTarget.textContent || "";
    setLocalContent(newContent);
    previousContentRef.current = newContent;
    onChange(newContent);
  };
  
  // Handle text-to-speech
  const handleTTS = async () => {
    if (!apiKey || !content || isPlayingTTS || isLoadingTTS) return;

    try {
      setIsLoadingTTS(true);
      
      // If there's already audio playing, stop it
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      
      // Generate speech using ElevenLabs
      const audioBlob = await generateSpeech({
        text: content,
        voiceId: selectedVoice.id,
        apiKey
      });
      
      // Create audio element
      const audio = new Audio();
      audio.src = URL.createObjectURL(audioBlob);
      
      // Set up audio events
      audio.onplay = () => setIsPlayingTTS(true);
      audio.onended = () => {
        setIsPlayingTTS(false);
        URL.revokeObjectURL(audio.src);
      };
      audio.onpause = () => setIsPlayingTTS(false);
      audio.onerror = (e) => {
        logger.error('audio', 'Error playing TTS audio', e);
        setIsPlayingTTS(false);
        setIsLoadingTTS(false);
      };
      
      // Store reference and play
      audioRef.current = audio;
      audio.play();
      
      setIsLoadingTTS(false);
    } catch (error) {
      logger.error('audio', 'Error generating speech', error);
      setIsLoadingTTS(false);
    }
  };

  // Stop TTS playback
  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlayingTTS(false);
    }
  };

  return (
    <div 
      className="relative group block-container"
      onMouseEnter={() => setShowTTSButton(true)}
      onMouseLeave={() => setShowTTSButton(false)}
    >
      <div
        id={`block-${id}`}
        ref={contentEditableRef}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        className={`py-1 px-2 rounded-md transition-colors outline-none ${
          isActive ? "bg-blue-900/10 dark:bg-blue-900/20" : "hover:bg-gray-900/5 dark:hover:bg-gray-800/40"
        } ${isPlayingTTS ? "tts-highlight" : ""}`}
        onInput={handleInput}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        data-block-type="text"
        dangerouslySetInnerHTML={{ __html: localContent }}
      />
      
      {/* TTS Button - only show if TTS is enabled, we have an API key, and there's content */}
      {isTTSEnabled && apiKey && content && showTTSButton && (
        <button 
          onClick={isPlayingTTS ? stopPlayback : handleTTS}
          disabled={isLoadingTTS}
          className={`block-tts-button ${isPlayingTTS ? "playing" : ""}`}
          title={isPlayingTTS ? "Stop" : "Read with ElevenLabs"}
        >
          {isLoadingTTS ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Volume2 size={14} className={isPlayingTTS ? "text-blue-400" : ""} />
          )}
        </button>
      )}
    </div>
  );
};

export default TextBlock;