// components/editor/blocks/CodeBlock.tsx
import React, { useRef, useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import logger from "@/utils/logger";

interface CodeBlockProps {
  id: string;
  content: string;
  language?: string;
  isActive: boolean;
  onChange: (content: string) => void;
  onLanguageChange: (language: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  readOnly?: boolean;
}

const SUPPORTED_LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "html",
  "css",
  "json",
  "markdown",
  "jsx",
  "tsx",
  "bash",
  "sql",
  "plain"
];

const CodeBlock: React.FC<CodeBlockProps> = ({
  id,
  content,
  language = "plain",
  isActive,
  onChange,
  onLanguageChange,
  onFocus,
  onBlur,
  onKeyDown,
  readOnly = false
}) => {
  const contentEditableRef = useRef<HTMLPreElement>(null);
  const [localContent, setLocalContent] = useState(content);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const previousContentRef = useRef(content);
  const selectionPositionRef = useRef<{ start: number; end: number } | null>(null);

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
        range.collapse(false);
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

  const handleInput = (e: React.FormEvent<HTMLPreElement>) => {
    saveSelectionPosition();
    const newContent = e.currentTarget.textContent || "";
    setLocalContent(newContent);
    previousContentRef.current = newContent;
    onChange(newContent);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content)
      .then(() => {
        setCopiedToClipboard(true);
        setTimeout(() => setCopiedToClipboard(false), 2000);
        logger.info('ui', 'Code copied to clipboard');
      })
      .catch(err => {
        logger.error('ui', 'Failed to copy code to clipboard', err);
      });
  };

  const handleLanguageSelect = (lang: string) => {
    onLanguageChange(lang);
    setShowLanguageDropdown(false);
  };

  // Handle tab key for indentation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Call the parent handler first
    onKeyDown(e);

    // Special handling for tab in code blocks
    if (e.key === 'Tab') {
      e.preventDefault();
      
      // Save selection position
      saveSelectionPosition();
      
      // Insert 2 spaces at cursor position
      document.execCommand('insertText', false, '  ');
    }
  };

  return (
    <div 
      className={`font-mono rounded-md overflow-hidden transition-colors 
        ${isActive ? "ring-2 ring-blue-500" : "hover:bg-gray-50 dark:hover:bg-gray-800/40"}`}
    >
      {/* Code block header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
            className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
          >
            {language || "plain"}
          </button>
          
          {/* Language dropdown */}
          {showLanguageDropdown && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto">
              {SUPPORTED_LANGUAGES.map(lang => (
                <button
                  key={lang}
                  onClick={() => handleLanguageSelect(lang)}
                  className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 
                    ${lang === language ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" : ""}`}
                >
                  {lang}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <button
          type="button"
          onClick={copyToClipboard}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          title="Copy code"
        >
          {copiedToClipboard ? (
            <div className="flex items-center">
              <Check size={16} className="text-green-500" />
              <span className="ml-1 text-xs text-green-500">Copied!</span>
            </div>
          ) : (
            <Copy size={16} />
          )}
        </button>
      </div>
      
      {/* Code content */}
      <pre
        id={`block-${id}`}
        ref={contentEditableRef}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        className={`p-4 outline-none whitespace-pre-wrap text-sm overflow-auto max-h-96 bg-gray-50 dark:bg-gray-900 ${
          language === 'javascript' || language === 'typescript' || language === 'jsx' || language === 'tsx' 
            ? 'text-blue-600 dark:text-blue-400' 
            : language === 'html' || language === 'xml' 
              ? 'text-red-600 dark:text-red-400'
              : language === 'css' 
                ? 'text-purple-600 dark:text-purple-400'
                : 'text-gray-800 dark:text-gray-200'
        }`}
        onInput={handleInput}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={handleKeyDown}
        data-block-type="code"
        data-language={language}
        spellCheck="false"
        dangerouslySetInnerHTML={{ __html: localContent }}
      />
    </div>
  );
};

export default CodeBlock;