// components/editor/blocks/HeadingBlock.tsx
import React, { useRef, useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface HeadingBlockProps {
  id: string;
  content: string;
  level: 1 | 2 | 3;
  isActive: boolean;
  onChange: (content: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  readOnly?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

const HeadingBlock: React.FC<HeadingBlockProps> = ({
  id,
  content,
  level = 1,
  isActive,
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  readOnly = false,
  isCollapsed = false,
  onToggleCollapse
}) => {
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const [localContent, setLocalContent] = useState(content);
  const [isEmpty, setIsEmpty] = useState(!content);
  const previousContentRef = useRef(content);
  const selectionPositionRef = useRef<{ start: number; end: number } | null>(null);

  // Only update the content from props when the block is not active
  // This prevents cursor jumps while typing
  useEffect(() => {
    if (!isActive && contentEditableRef.current && content !== previousContentRef.current) {
      contentEditableRef.current.textContent = content;
      setLocalContent(content);
      setIsEmpty(!content);
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

  // Set up the placeholder effect
  useEffect(() => {
    if (contentEditableRef.current) {
      if (isEmpty && !isActive) {
        // Show placeholder when empty and not focused
        contentEditableRef.current.dataset.placeholder = `Heading ${level}`;
      } else {
        // Remove placeholder when has content or is focused
        delete contentEditableRef.current.dataset.placeholder;
      }
    }
  }, [isEmpty, isActive, level]);

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
    setIsEmpty(!newContent);
    previousContentRef.current = newContent;
    onChange(newContent);
  };

  // Get the heading class based on level
  const getHeadingClass = () => {
    switch (level) {
      case 1:
        return "text-2xl font-bold";
      case 2:
        return "text-xl font-semibold";
      case 3:
        return "text-lg font-medium";
      default:
        return "text-2xl font-bold";
    }
  };

  return (
    <div className="flex items-center group">
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="mr-2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
          aria-label={isCollapsed ? "Expand" : "Collapse"}
        >
          {isCollapsed ? (
            <ChevronDown size={16} />
          ) : (
            <ChevronUp size={16} />
          )}
        </button>
      )}
      <div
        id={`block-${id}`}
        ref={contentEditableRef}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        className={`py-1 px-2 w-full rounded-md transition-colors outline-none ${getHeadingClass()} 
          ${isActive ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800/40"}
          empty:before:text-gray-400 empty:before:content-[attr(data-placeholder)] empty:before:pointer-events-none
        `}
        onInput={handleInput}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        data-block-type="heading"
        data-heading-level={level}
        dangerouslySetInnerHTML={{ __html: localContent }}
      />
    </div>
  );
};

export default HeadingBlock;