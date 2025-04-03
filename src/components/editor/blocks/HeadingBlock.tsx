// components/editor/blocks/HeadingBlock.tsx
import React, { useRef, useEffect } from "react";

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
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [isActive]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newContent = e.currentTarget.textContent || "";
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
    <div
      id={`block-${id}`}
      ref={contentEditableRef}
      contentEditable={!readOnly}
      suppressContentEditableWarning
      className={`py-1 px-2 rounded-md transition-colors outline-none ${getHeadingClass()} ${
        isActive ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
      }`}
      onInput={handleInput}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      data-block-type="heading"
      data-heading-level={level}
    />
  );
};

export default HeadingBlock;