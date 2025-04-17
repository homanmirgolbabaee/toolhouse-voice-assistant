// components/editor/blocks/CodeBlock.tsx
import React, { useRef, useEffect, useState } from "react";
import { Copy, Check, Code as CodeIcon } from "lucide-react";
import logger from "@/utils/logger";
import Prism from 'prismjs';

// Import basic Prism styles - you'll need to add this package
// If you don't have Prism.js installed, run: npm install prismjs
import 'prismjs/themes/prism-tomorrow.css';

// Import language support
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-ruby';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-php';

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
  { id: "javascript", display: "JavaScript" },
  { id: "typescript", display: "TypeScript" },
  { id: "jsx", display: "JSX" },
  { id: "tsx", display: "TSX" },
  { id: "python", display: "Python" },
  { id: "html", display: "HTML" },
  { id: "css", display: "CSS" },
  { id: "java", display: "Java" },
  { id: "c", display: "C" },
  { id: "cpp", display: "C++" },
  { id: "csharp", display: "C#" },
  { id: "ruby", display: "Ruby" },
  { id: "go", display: "Go" },
  { id: "rust", display: "Rust" },
  { id: "bash", display: "Bash" },
  { id: "sql", display: "SQL" },
  { id: "json", display: "JSON" },
  { id: "yaml", display: "YAML" },
  { id: "markdown", display: "Markdown" },
  { id: "php", display: "PHP" },
  { id: "plain", display: "Plain Text" }
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
  const highlightRef = useRef<HTMLPreElement>(null);
  const [localContent, setLocalContent] = useState(content);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [copiedToClipboard, setCopiedToClipboard] = useState(false);
  const previousContentRef = useRef(content);
  const selectionPositionRef = useRef<{ start: number; end: number } | null>(null);
  const [lineNumbers, setLineNumbers] = useState<string[]>([]);

  // Only update the content from props when the block is not active
  // This prevents cursor jumps while typing
  useEffect(() => {
    if (!isActive && contentEditableRef.current && content !== previousContentRef.current) {
      contentEditableRef.current.textContent = content;
      setLocalContent(content);
      previousContentRef.current = content;
      highlightCode(content);
      updateLineNumbers(content);
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

  // Highlight code when language changes
  useEffect(() => {
    highlightCode(localContent);
  }, [language, localContent]);

  // Update line numbers when content changes
  useEffect(() => {
    updateLineNumbers(localContent);
  }, [localContent]);

  // Update line numbers based on content
  const updateLineNumbers = (code: string) => {
    const lines = code.split('\n');
    setLineNumbers(Array.from({ length: lines.length }, (_, i) => String(i + 1)));
  };

  // Highlight code using Prism.js
  const highlightCode = (code: string) => {
    if (!highlightRef.current) return;
    
    const langClass = language === 'plain' ? 'language-text' : `language-${language}`;
    
    // Apply highlighting
    try {
      highlightRef.current.innerHTML = code;
      highlightRef.current.className = `prism-code ${langClass}`;
      
      // Highlight the code
      if (language !== 'plain') {
        Prism.highlightElement(highlightRef.current);
      }
    } catch (error) {
      logger.error('editor', 'Error highlighting code:', error);
    }
  };

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
    
    // Update highlighting and line numbers
    highlightCode(newContent);
    updateLineNumbers(newContent);
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
    // Re-highlight the code with the new language
    setTimeout(() => highlightCode(localContent), 0);
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

  // Find the display name for the current language
  const currentLanguageDisplay = SUPPORTED_LANGUAGES.find(lang => lang.id === language)?.display || 'Plain Text';

  return (
    <div 
      className={`font-mono rounded-md overflow-hidden transition-colors shadow-sm
        ${isActive ? "ring-2 ring-blue-500" : "hover:ring-1 hover:ring-gray-300 dark:hover:ring-gray-700"}`}
    >
      {/* Code block header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 text-gray-300">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowLanguageDropdown(!showLanguageDropdown)}
            className="flex items-center space-x-1 text-sm hover:text-gray-100"
          >
            <CodeIcon size={14} className="mr-1" />
            <span>{currentLanguageDisplay}</span>
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="12" 
              height="12" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
              className="ml-1"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </button>
          
          {/* Language dropdown */}
          {showLanguageDropdown && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-gray-800 rounded-md shadow-lg border border-gray-700 max-h-60 overflow-y-auto w-48">
              {SUPPORTED_LANGUAGES.map(lang => (
                <button
                  key={lang.id}
                  onClick={() => handleLanguageSelect(lang.id)}
                  className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-700 
                    ${lang.id === language ? "bg-gray-700 text-blue-400" : "text-gray-300"}`}
                >
                  {lang.display}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <button
          type="button"
          onClick={copyToClipboard}
          className="text-gray-400 hover:text-gray-100 transition-colors"
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
      
      {/* Code content with line numbers */}
      <div className="relative bg-gray-900 text-gray-200 flex">
        {/* Line numbers */}
        <div className="text-right pr-3 py-4 select-none bg-gray-800 text-gray-500 text-xs border-r border-gray-700">
          {lineNumbers.map((num, i) => (
            <div key={i} className="leading-relaxed">{num}</div>
          ))}
        </div>
        
        {/* Code editor */}
        <div className="relative flex-grow">
          {/* Highlighted code (read-only, shown behind the editable content) */}
          <pre
            ref={highlightRef}
            className={`prism-code language-${language} absolute inset-0 !m-0 !outline-none py-4 px-3 !bg-transparent pointer-events-none overflow-auto`}
            aria-hidden="true"
          ></pre>
          
          {/* Editable content (transparent text that sits on top) */}
          <pre
            id={`block-${id}`}
            ref={contentEditableRef}
            contentEditable={!readOnly}
            suppressContentEditableWarning
            className="relative !m-0 !outline-none py-4 px-3 !bg-transparent overflow-auto whitespace-pre z-10 !text-transparent !caret-gray-200"
            onInput={handleInput}
            onFocus={onFocus}
            onBlur={onBlur}
            onKeyDown={handleKeyDown}
            data-block-type="code"
            data-language={language}
            spellCheck="false"
          >{localContent}</pre>
        </div>
      </div>
    </div>
  );
};

export default CodeBlock;