// components/editor/blocks/TodoBlock.tsx
import React, { useRef, useEffect, useState } from "react";

interface TodoBlockProps {
  id: string;
  content: string;
  checked: boolean;
  isActive: boolean;
  onChange: (content: string) => void;
  onCheckChange: (checked: boolean) => void;
  onFocus: () => void;
  onBlur: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  readOnly?: boolean;
}

const TodoBlock: React.FC<TodoBlockProps> = ({
  id,
  content,
  checked,
  isActive,
  onChange,
  onCheckChange,
  onFocus,
  onBlur,
  onKeyDown,
  readOnly = false
}) => {
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const [localContent, setLocalContent] = useState(content);
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

  return (
    <div className="flex items-start gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onCheckChange(!checked)}
        className="mt-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700"
        disabled={readOnly}
      />
      <div
        id={`block-${id}`}
        ref={contentEditableRef}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        className={`flex-1 py-1 px-2 ${
          checked ? 'line-through text-gray-500 dark:text-gray-400' : ''
        } ${
          isActive ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
        } rounded-md outline-none transition-colors`}
        onInput={handleInput}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        data-block-type="todo"
        dangerouslySetInnerHTML={{ __html: localContent }}
      />
    </div>
  );
};

export default TodoBlock;