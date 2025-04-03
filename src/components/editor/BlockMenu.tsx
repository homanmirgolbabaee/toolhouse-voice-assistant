// components/editor/BlockMenu.tsx
import React, { useEffect, useRef } from "react";
import { Block } from "@/models/document";
import { 
  Text, 
  Heading, 
  List, 
  Code, 
  CheckSquare,
  Image,
  FileText
} from "lucide-react";

interface BlockMenuProps {
  position: { x: number; y: number };
  onSelect: (type: Block["type"]) => void;
  onClose: () => void;
}

export default function BlockMenu({ position, onSelect, onClose }: BlockMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Block type options
  const blockTypes = [
    { type: "text" as const, icon: Text, label: "Text" },
    { type: "heading" as const, icon: Heading, label: "Heading" },
    { type: "list" as const, icon: List, label: "List" },
    { type: "code" as const, icon: Code, label: "Code" },
    { type: "todo" as const, icon: CheckSquare, label: "To-do" },
  ];

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 py-1 w-56"
      style={{
        left: position.x,
        top: position.y + 10,
      }}
    >
      <div className="px-3 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
        Turn into
      </div>
      <div className="py-1">
        {blockTypes.map((blockType) => (
          <button
            key={blockType.type}
            className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => {
              onSelect(blockType.type);
            }}
          >
            <blockType.icon size={16} className="mr-2" />
            {blockType.label}
          </button>
        ))}
      </div>
    </div>
  );
}