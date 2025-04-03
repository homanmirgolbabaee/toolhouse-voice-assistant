// components/editor/blocks/TodoBlock.tsx
import React, { useRef, useEffect } from "react";
import { Check } from "lucide-react";

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

  const toggleCheck = () => {
    if (!readOnly) {
      onCheckChange(!checked);
    }
  };

  return (
    <div className={`flex items-start py-1 px-2 rounded-md transition-colors ${
      isActive ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
    }`}>
      <button
        type="button"
        onClick={toggleCheck}
        className={`flex-shrink-0 w-5 h-5 mr-2 mt-0.5 border rounded flex items-center justify-center ${
          checked 
            ? "bg-blue-500 border-blue-500 text-white" 
            : "border-gray-300 dark:border-gray-600"
        }`}
        disabled={readOnly}
        aria-checked={checked}
        role="checkbox"
      >
        {checked && <Check size={12} />}
      </button>
      <div
        id={`block-${id}`}
        ref={contentEditableRef}
        contentEditable={!readOnly}
        suppressContentEditableWarning
        className={`flex-1 outline-none ${
          checked ? "text-gray-500 line-through" : ""
        }`}
        onInput={handleInput}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        data-block-type="todo"
        data-checked={checked}
      />
    </div>
  );
};

export default TodoBlock;