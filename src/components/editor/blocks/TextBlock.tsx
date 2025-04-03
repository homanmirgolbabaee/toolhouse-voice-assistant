// components/editor/blocks/TextBlock.tsx
import React, { useRef, useEffect } from "react";

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

  // Sync content with the editable div
  useEffect(() => {
    if (contentEditableRef.current && contentEditableRef.current.textContent !== content) {
      contentEditableRef.current.textContent = content;
    }
  }, [content]);

  // Focus the element when it becomes active
  useEffect(() => {
    if (isActive && contentEditableRef.current) {
      contentEditableRef.current.focus();
      
      // Move cursor to the end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(contentEditableRef.current);
      range.collapse(false); // collapse to the end
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [isActive]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newContent = e.currentTarget.textContent || "";
    onChange(newContent);
  };

  return (
    <div
      id={`block-${id}`}
      ref={contentEditableRef}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      className={`py-1 px-2 rounded-md transition-colors outline-none ${
        isActive ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
      }`}
      onInput={handleInput}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      data-block-type="text"
    />
  );
};

export default TextBlock;