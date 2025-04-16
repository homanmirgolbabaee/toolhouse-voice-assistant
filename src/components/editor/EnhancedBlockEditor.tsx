// components/editor/EnhancedBlockEditor.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { Block, BlockType } from "@/models/document";
import {
  Type, Heading1, Heading2, Heading3, List, Check, Code, Mic, GripVertical, 
  Trash2, Plus, Copy, MoreVertical, ChevronDown, ChevronUp, Image, Table, 
  Link, Clock, Calendar, AlignLeft
} from "lucide-react";

interface EnhancedBlockEditorProps {
  initialBlocks?: Block[];
  onSave?: (blocks: Block[]) => void;
  readOnly?: boolean;
  documentId?: string;
  onDeleteDocument?: () => void;
}

export default function EnhancedBlockEditor({
  initialBlocks = [],
  onSave,
  readOnly = false,
  documentId,
  onDeleteDocument
}: EnhancedBlockEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>(
    initialBlocks.length > 0
      ? initialBlocks
      : [{ id: uuidv4(), type: "text", content: "" }]
  );
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [targetBlockId, setTargetBlockId] = useState<string | null>(null);
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<string>>(new Set());
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  
  const editorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Define available block types
  const blockTypes = [
    { type: "text", icon: Type, label: "Text" },
    { type: "heading", icon: Heading1, label: "Heading 1", props: { level: 1 } },
    { type: "heading", icon: Heading2, label: "Heading 2", props: { level: 2 } },
    { type: "heading", icon: Heading3, label: "Heading 3", props: { level: 3 } },
    { type: "list", icon: List, label: "Bullet List" },
    { type: "todo", icon: Check, label: "To-do" },
    { type: "code", icon: Code, label: "Code" },
    { type: "audio", icon: Mic, label: "Voice Note" }
  ];

  // Basic block updater
  const updateBlock = useCallback((id: string, updates: Partial<Block>) => {
    setBlocks(prevBlocks =>
      prevBlocks.map(block => (block.id === id ? { ...block, ...updates } : block))
    );
    setUnsavedChanges(true);
  }, []);

  // Add new block after the specified one
  const addBlockAfter = useCallback((id: string, type: BlockType = "text", properties?: any) => {
    const newBlockId = uuidv4();
    
    setBlocks(prevBlocks => {
      const index = prevBlocks.findIndex(block => block.id === id);
      if (index === -1) return prevBlocks;
      
      const newBlocks = [...prevBlocks];
      newBlocks.splice(index + 1, 0, {
        id: newBlockId,
        type,
        content: "",
        properties
      });
      
      return newBlocks;
    });
    
    // Focus the new block after render
    setTimeout(() => {
      setActiveBlockId(newBlockId);
      const element = document.getElementById(`block-${newBlockId}`);
      if (element) element.focus();
    }, 10);
    
    setUnsavedChanges(true);
  }, []);

  // Delete block
  const deleteBlock = useCallback((id: string) => {
    // Don't delete if it's the only block
    if (blocks.length <= 1) return;
    
    setBlocks(prevBlocks => {
      const index = prevBlocks.findIndex(block => block.id === id);
      if (index === -1) return prevBlocks;
      
      const newBlocks = [...prevBlocks];
      newBlocks.splice(index, 1);
      
      // Focus the previous block (or the next one if deleting the first block)
      setTimeout(() => {
        const newIndex = Math.max(0, index - 1);
        const blockToFocus = newBlocks[newIndex];
        if (blockToFocus) {
          setActiveBlockId(blockToFocus.id);
          document.getElementById(`block-${blockToFocus.id}`)?.focus();
        }
      }, 10);
      
      return newBlocks;
    });
    
    setUnsavedChanges(true);
  }, [blocks.length]);

  // Toggle block collapse
  const toggleBlockCollapse = useCallback((id: string) => {
    setCollapsedBlocks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  // Change block type
  const changeBlockType = useCallback((id: string, newType: BlockType, properties?: any) => {
    updateBlock(id, { type: newType, properties: properties || {} });
  }, [updateBlock]);

  // Duplicate block
  const duplicateBlock = useCallback((blockId: string) => {
    const blockToDuplicate = blocks.find(block => block.id === blockId);
    if (!blockToDuplicate) return;
    
    const newBlockId = uuidv4();
    
    setBlocks(prevBlocks => {
      const index = prevBlocks.findIndex(block => block.id === blockId);
      if (index === -1) return prevBlocks;
      
      const newBlocks = [...prevBlocks];
      newBlocks.splice(index + 1, 0, {
        id: newBlockId,
        type: blockToDuplicate.type,
        content: blockToDuplicate.content,
        properties: blockToDuplicate.properties ? { ...blockToDuplicate.properties } : undefined
      });
      
      return newBlocks;
    });
    
    setUnsavedChanges(true);
  }, [blocks]);

  // Move block up or down
  const moveBlockUp = useCallback((blockId: string) => {
    const index = blocks.findIndex(block => block.id === blockId);
    if (index <= 0) return;
    
    setBlocks(prevBlocks => {
      const newBlocks = [...prevBlocks];
      const temp = newBlocks[index];
      newBlocks[index] = newBlocks[index - 1];
      newBlocks[index - 1] = temp;
      return newBlocks;
    });
    
    setUnsavedChanges(true);
  }, [blocks]);

  const moveBlockDown = useCallback((blockId: string) => {
    const index = blocks.findIndex(block => block.id === blockId);
    if (index === -1 || index >= blocks.length - 1) return;
    
    setBlocks(prevBlocks => {
      const newBlocks = [...prevBlocks];
      const temp = newBlocks[index];
      newBlocks[index] = newBlocks[index + 1];
      newBlocks[index + 1] = temp;
      return newBlocks;
    });
    
    setUnsavedChanges(true);
  }, [blocks]);

  // Handle key press in blocks
  const handleBlockKeyDown = useCallback((e: React.KeyboardEvent, blockId: string) => {
    // Find current block index
    const index = blocks.findIndex(block => block.id === blockId);
    if (index === -1) return;
    
    const currentBlock = blocks[index];

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      addBlockAfter(blockId);
    } 
    else if (e.key === "Backspace" && currentBlock.content === "") {
      e.preventDefault();
      deleteBlock(blockId);
    }
    else if (e.key === "ArrowUp") {
      if (index > 0) {
        e.preventDefault();
        const prevBlockId = blocks[index - 1].id;
        setActiveBlockId(prevBlockId);
        document.getElementById(`block-${prevBlockId}`)?.focus();
      }
    }
    else if (e.key === "ArrowDown") {
      if (index < blocks.length - 1) {
        e.preventDefault();
        const nextBlockId = blocks[index + 1].id;
        setActiveBlockId(nextBlockId);
        document.getElementById(`block-${nextBlockId}`)?.focus();
      }
    }
    else if (e.key === "/" && currentBlock.content === "") {
      e.preventDefault();
      // Position and show block menu
      const blockElement = document.getElementById(`block-${blockId}`);
      if (blockElement) {
        const rect = blockElement.getBoundingClientRect();
        setMenuPosition({ x: rect.left, y: rect.bottom + window.scrollY });
        setTargetBlockId(blockId);
        setShowBlockMenu(true);
      }
    }
  }, [blocks, addBlockAfter, deleteBlock]);

  // Close block menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowBlockMenu(false);
      }
    };

    if (showBlockMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showBlockMenu]);

  // Auto-save when there are unsaved changes
  useEffect(() => {
    if (unsavedChanges && onSave) {
      const saveTimeout = setTimeout(() => {
        onSave(blocks);
        setUnsavedChanges(false);
      }, 1000);

      return () => clearTimeout(saveTimeout);
    }
  }, [unsavedChanges, onSave, blocks]);

  // Render placeholder for empty editor
  const renderPlaceholder = () => {
    if (blocks.length !== 1 || blocks[0].content.trim() !== '' || !showPlaceholder) {
      return null;
    }

    return (
      <div className="absolute pointer-events-none top-0 left-0 p-2 text-gray-400 dark:text-gray-500 text-lg font-light">
        Begin typing, or press '/' for commands...
      </div>
    );
  };

  // Render a block action menu
  const BlockActions = ({ blockId }: { blockId: string }) => {
    const [showMenu, setShowMenu] = useState(false);
    
    return (
      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={() => setShowMenu(!showMenu)}
          className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:text-gray-200 dark:hover:bg-gray-800"
        >
          <MoreVertical size={16} />
        </button>
        
        {showMenu && (
          <div className="absolute right-0 top-full mt-1 z-10 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1">
            <button
              onClick={() => {
                duplicateBlock(blockId);
                setShowMenu(false);
              }}
              className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Copy size={14} className="mr-2" />
              Duplicate
            </button>
            <button
              onClick={() => {
                moveBlockUp(blockId);
                setShowMenu(false);
              }}
              className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ChevronUp size={14} className="mr-2" />
              Move up
            </button>
            <button
              onClick={() => {
                moveBlockDown(blockId);
                setShowMenu(false);
              }}
              className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ChevronDown size={14} className="mr-2" />
              Move down
            </button>
            <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
            <button
              onClick={() => {
                const blockElement = document.getElementById(`block-${blockId}`);
                if (blockElement) {
                  const rect = blockElement.getBoundingClientRect();
                  setMenuPosition({ x: rect.left, y: rect.bottom + window.scrollY });
                  setTargetBlockId(blockId);
                  setShowBlockMenu(true);
                }
                setShowMenu(false);
              }}
              className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Type size={14} className="mr-2" />
              Change block type
            </button>
            <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
            <button
              onClick={() => {
                deleteBlock(blockId);
                setShowMenu(false);
              }}
              className="flex items-center w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <Trash2 size={14} className="mr-2" />
              Delete
            </button>
          </div>
        )}
      </div>
    );
  };

  // Render the block menu for selecting block types
  const renderBlockMenu = () => {
    if (!showBlockMenu) return null;
    
    return (
      <div 
        ref={menuRef}
        className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-64 max-h-80 overflow-y-auto"
        style={{
          left: `${menuPosition.x}px`,
          top: `${menuPosition.y}px`
        }}
      >
        <div className="p-2 border-b border-gray-200 dark:border-gray-700">
          <input
            type="text"
            placeholder="Search for blocks..."
            className="w-full px-3 py-1.5 bg-gray-100 dark:bg-gray-700 border-0 rounded-md text-sm focus:ring-2 focus:ring-primary"
            autoFocus
          />
        </div>
        
        <div className="py-1">
          {blockTypes.map((type, index) => (
            <button
              key={index}
              className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => {
                if (targetBlockId) {
                  changeBlockType(
                    targetBlockId,
                    type.type as BlockType,
                    type.props || {}
                  );
                }
                setShowBlockMenu(false);
              }}
            >
              <div className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-md mr-2 text-gray-700 dark:text-gray-300">
                <type.icon size={16} />
              </div>
              <div>
                <p className="font-medium">{type.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {type.type === "text" && "Plain paragraph text"}
                  {type.type === "heading" && `Level ${type.props?.level} heading`}
                  {type.type === "list" && "Simple bullet list item"}
                  {type.type === "todo" && "To-do list with checkbox"}
                  {type.type === "code" && "Code block with syntax highlighting"}
                  {type.type === "audio" && "Voice recording note"}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  // Render a block based on its type
  const renderBlockContent = (block: Block) => {
    const isActive = activeBlockId === block.id;
    
    switch (block.type) {
      case 'heading':
        const level = block.properties?.level || 1;
        const headingClass = level === 1 
          ? 'text-2xl font-bold' 
          : level === 2 
            ? 'text-xl font-semibold' 
            : 'text-lg font-medium';
        
        return (
          <div 
            id={`block-${block.id}`}
            contentEditable={!readOnly}
            suppressContentEditableWarning
            className={`${headingClass} w-full outline-none p-2 rounded-md ${
              isActive ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-gray-50/70 dark:hover:bg-gray-800/30'
            } transition-colors`}
            onFocus={() => setActiveBlockId(block.id)}
            onBlur={() => setActiveBlockId(null)}
            onKeyDown={(e) => handleBlockKeyDown(e, block.id)}
            dangerouslySetInnerHTML={{ __html: block.content }}
            onInput={(e) => updateBlock(block.id, { 
              content: e.currentTarget.textContent || "" 
            })}
          />
        );
      
      case 'todo':
        return (
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={!!block.properties?.checked}
              onChange={() => 
                updateBlock(block.id, { 
                  properties: { 
                    ...block.properties, 
                    checked: !block.properties?.checked
                  } 
                })
              }
              className="rounded border-gray-300 w-5 h-5 mt-3 text-primary focus:ring-primary dark:border-gray-700"
            />
            <div 
              id={`block-${block.id}`}
              contentEditable={!readOnly}
              suppressContentEditableWarning
              className={`flex-1 outline-none p-2 rounded-md ${
                block.properties?.checked ? 'line-through text-gray-500 dark:text-gray-400' : ''
              } ${
                isActive ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-gray-50/70 dark:hover:bg-gray-800/30'
              } transition-colors`}
              onFocus={() => setActiveBlockId(block.id)}
              onBlur={() => setActiveBlockId(null)}
              onKeyDown={(e) => handleBlockKeyDown(e, block.id)}
              dangerouslySetInnerHTML={{ __html: block.content }}
              onInput={(e) => updateBlock(block.id, { 
                content: e.currentTarget.textContent || "" 
              })}
            />
          </div>
        );
      
      case 'list':
        return (
          <div className="flex">
            <div className="w-8 flex justify-center pt-2.5">•</div>
            <div 
              id={`block-${block.id}`}
              contentEditable={!readOnly}
              suppressContentEditableWarning
              className={`flex-1 outline-none p-2 rounded-md ${
                isActive ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-gray-50/70 dark:hover:bg-gray-800/30'
              } transition-colors`}
              onFocus={() => setActiveBlockId(block.id)}
              onBlur={() => setActiveBlockId(null)}
              onKeyDown={(e) => handleBlockKeyDown(e, block.id)}
              dangerouslySetInnerHTML={{ __html: block.content }}
              onInput={(e) => updateBlock(block.id, { 
                content: e.currentTarget.textContent || "" 
              })}
            />
          </div>
        );
      
      case 'code':
        return (
          <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between bg-gray-100 dark:bg-gray-800 px-3 py-2 text-sm">
              <span className="text-gray-600 dark:text-gray-300">
                {block.properties?.language || 'plain text'}
              </span>
              <button
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                onClick={() => {
                  navigator.clipboard.writeText(block.content);
                  // Show a small feedback notification here
                }}
              >
                <Copy size={14} />
              </button>
            </div>
            <pre 
              id={`block-${block.id}`}
              contentEditable={!readOnly}
              suppressContentEditableWarning
              className="m-0 p-3 bg-gray-50 dark:bg-gray-900 font-mono text-sm overflow-x-auto"
              onFocus={() => setActiveBlockId(block.id)}
              onBlur={() => setActiveBlockId(null)}
              onKeyDown={(e) => handleBlockKeyDown(e, block.id)}
              dangerouslySetInnerHTML={{ __html: block.content }}
              onInput={(e) => updateBlock(block.id, { 
                content: e.currentTarget.textContent || "" 
              })}
              spellCheck="false"
            ></pre>
          </div>
        );
      
      case 'audio':
        // Content for audio block should be an audio URL
        if (!block.content) {
          return (
            <div className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <Mic size={18} className="text-primary" />
              <span className="text-gray-600 dark:text-gray-300">
                Click to record a voice note
              </span>
            </div>
          );
        }
        
        return (
          <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <audio
              controls
              src={block.content}
              className="w-full"
              preload="metadata"
            ></audio>
          </div>
        );
      
      default: // text block
        return (
          <div 
            id={`block-${block.id}`}
            contentEditable={!readOnly}
            suppressContentEditableWarning
            className={`w-full outline-none p-2 rounded-md ${
              isActive ? 'bg-blue-50/50 dark:bg-blue-900/10' : 'hover:bg-gray-50/70 dark:hover:bg-gray-800/30'
            } transition-colors`}
            onFocus={() => {
              setActiveBlockId(block.id);
              setShowPlaceholder(false);
            }}
            onBlur={() => {
              setActiveBlockId(null);
              setShowPlaceholder(true);
            }}
            onKeyDown={(e) => handleBlockKeyDown(e, block.id)}
            dangerouslySetInnerHTML={{ __html: block.content }}
            onInput={(e) => updateBlock(block.id, { 
              content: e.currentTarget.textContent || "" 
            })}
          />
        );
    }
  };

  const handleAddNewBlock = () => {
    if (blocks.length > 0) {
      addBlockAfter(blocks[blocks.length - 1].id);
    } else {
      // Add first block if none exist
      const newBlockId = uuidv4();
      setBlocks([{ id: newBlockId, type: "text", content: "" }]);
      setTimeout(() => {
        setActiveBlockId(newBlockId);
        document.getElementById(`block-${newBlockId}`)?.focus();
      }, 10);
    }
  };

  return (
    <div className="w-full relative editor-content" ref={editorRef}>
      {blocks.map((block, index) => (
        <div 
          key={block.id}
          className={`group relative flex flex-col mb-1 block ${
            activeBlockId === block.id ? 'is-active' : ''
          }`}
        >
          {/* Block drag handle */}
          <div className="absolute -left-8 top-2 opacity-0 group-hover:opacity-100 cursor-grab p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <GripVertical size={16} />
          </div>
          
          {/* Main block content */}
          <div className="relative">
            {renderBlockContent(block)}
            
            {/* Block actions menu */}
            <BlockActions blockId={block.id} />
            
            {/* Add button between blocks (on hover) */}
            <div className="absolute left-0 h-3 -top-1.5 w-full flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => {
                  const prevIndex = Math.max(0, index - 1);
                  const prevBlock = blocks[prevIndex];
                  addBlockAfter(prevBlock.id);
                }}
                className="h-6 w-6 rounded-full bg-primary text-white shadow-sm hover:bg-primary-dark transform hover:scale-105 transition-all"
              >
                <Plus size={16} className="m-auto" />
              </button>
            </div>
          </div>
        </div>
      ))}
      
      {/* Add block button at the end */}
      <button
        onClick={handleAddNewBlock}
        className="mt-4 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-primary-light transition-colors"
      >
        <Plus size={16} />
        <span>Add a block</span>
      </button>
      
      {/* Placeholder for empty editor */}
      {renderPlaceholder()}
      
      {/* Block type menu */}
      {renderBlockMenu()}
    </div>
  );
}