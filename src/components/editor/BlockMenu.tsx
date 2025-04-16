// components/editor/BlockMenu.tsx
import React, { useEffect, useRef, useState } from "react";
import { BlockType } from "@/models/document";
import { 
  Type, 
  Heading1,
  Heading2,
  Heading3, 
  List, 
  Code, 
  CheckSquare,
  Mic,
  Search,
} from "lucide-react";

interface BlockMenuProps {
  position: { x: number; y: number };
  onSelect: (type: BlockType, properties?: any) => void;
  onClose: () => void;
  filterText?: string;
  onFilterChange?: (text: string) => void;
}

// Define block options outside the component to avoid recreation on every render
const blockOptions = [
  { 
    type: "text" as BlockType,
    icon: Type, 
    label: "Text", 
    description: "Plain text block",
    keywords: ["paragraph", "plain", "text", "normal"]
  },
  { 
    type: "heading" as BlockType, 
    icon: Heading1, 
    label: "Heading 1", 
    description: "Large section heading", 
    properties: { level: 1 },
    keywords: ["h1", "title", "header", "large"]
  },
  { 
    type: "heading" as BlockType, 
    icon: Heading2, 
    label: "Heading 2", 
    description: "Medium section heading", 
    properties: { level: 2 },
    keywords: ["h2", "subtitle", "header", "medium"]
  },
  { 
    type: "heading" as BlockType, 
    icon: Heading3, 
    label: "Heading 3", 
    description: "Small section heading", 
    properties: { level: 3 },
    keywords: ["h3", "subtitle", "header", "small"]
  },
  { 
    type: "list" as BlockType, 
    icon: List, 
    label: "Bulleted List", 
    description: "Simple bullet list",
    keywords: ["bullet", "list", "unordered", "ul"]
  },
  { 
    type: "code" as BlockType, 
    icon: Code, 
    label: "Code", 
    description: "Code with syntax highlighting",
    keywords: ["code", "programming", "syntax", "dev"]
  },
  { 
    type: "todo" as BlockType, 
    icon: CheckSquare, 
    label: "To-do List", 
    description: "To-do checklist",
    keywords: ["todo", "checkbox", "task", "check"]
  },
  { 
    type: "audio" as BlockType, 
    icon: Mic, 
    label: "Voice Note", 
    description: "Record audio",
    keywords: ["voice", "audio", "record", "sound", "mic"]
  },
];

export default function BlockMenu({ 
  position, 
  onSelect, 
  onClose,
  filterText = "",
  onFilterChange
}: BlockMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState(filterText);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [menuPosition, setMenuPosition] = useState({ left: 0, top: 0 });
  
  // Calculate menu position when component mounts or position prop changes
  useEffect(() => {
    // Default positioning (adjust as needed)
    let left = position.x;
    let top = position.y;
    
    // Make sure menu appears in viewport
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const menuWidth = rect.width || 272; // Fallback width if not available
      const menuHeight = rect.height || 300; // Fallback height
      
      // Check right edge
      if (left + menuWidth > window.innerWidth) {
        left = Math.max(0, window.innerWidth - menuWidth - 20);
      }
      
      // Check bottom edge
      if (top + menuHeight > window.innerHeight) {
        top = Math.max(0, window.innerHeight - menuHeight - 20);
      }
    }
    
    setMenuPosition({ left, top });
  }, [position]);
  
  // Filter block types based on search
  const filteredBlockTypes = filter
    ? blockOptions.filter(blockType => 
        blockType.label.toLowerCase().includes(filter.toLowerCase()) ||
        blockType.description.toLowerCase().includes(filter.toLowerCase()) ||
        blockType.keywords.some(keyword => keyword.toLowerCase().includes(filter.toLowerCase()))
      )
    : blockOptions;
  
  // Focus the search input when the menu opens
  useEffect(() => {
    if (inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
    }
  }, []);

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
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredBlockTypes.length - 1 ? prev + 1 : 0
        );
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : filteredBlockTypes.length - 1
        );
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (filteredBlockTypes.length > 0) {
          const selected = filteredBlockTypes[selectedIndex];
          onSelect(selected.type, selected.properties);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, onSelect, selectedIndex, filteredBlockTypes]);

  // Handle filter change
  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFilter(value);
    setSelectedIndex(0); // Reset selection when filter changes
    if (onFilterChange) {
      onFilterChange(value);
    }
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 w-72 max-h-96 overflow-hidden flex flex-col"
      style={{
        left: `${menuPosition.left}px`,
        top: `${menuPosition.top}px`,
      }}
    >
      {/* Search input */}
      <div className="p-2 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search for blocks..."
            value={filter}
            onChange={handleFilterChange}
            className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-gray-700 border-none rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
            autoComplete="off"
          />
        </div>
      </div>
      
      {/* Block type menu */}
      <div className="overflow-y-auto py-1 flex-1">
        {filteredBlockTypes.length > 0 ? (
          filteredBlockTypes.map((blockType, index) => (
            <button
              key={`${blockType.type}-${blockType.label}`}
              className={`flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none ${
                index === selectedIndex ? "bg-gray-100 dark:bg-gray-700" : ""
              }`}
              onClick={() => {
                onSelect(blockType.type, blockType.properties);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              role="menuitem"
            >
              <div className="w-8 h-8 flex items-center justify-center rounded-md mr-3 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200">
                <blockType.icon size={16} />
              </div>
              <div className="flex-1 text-left">
                <div className="font-medium">{blockType.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{blockType.description}</div>
              </div>
            </button>
          ))
        ) : (
          <div className="px-3 py-6 text-sm text-gray-500 dark:text-gray-400 text-center">
            <div className="flex flex-col items-center">
              <Search className="h-8 w-8 text-gray-400 mb-2" />
              <p>No blocks found matching "{filter}"</p>
              <p className="text-xs mt-1">Try a different search term</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Quick help */}
      <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-2">
        <div className="text-xs text-gray-500 dark:text-gray-400 flex justify-between">
          <span><kbd className="px-1">↑↓</kbd> to navigate</span>
          <span><kbd className="px-1">↵</kbd> to select</span>
          <span><kbd className="px-1">Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}