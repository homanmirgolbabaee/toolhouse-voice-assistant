// components/editor/BlockEditor.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { Block } from "@/models/document";
import logger from "@/utils/logger";
import { useLogger } from "@/contexts/LoggerContext";
import { Type, Heading, List, Check, Code, Mic, GripVertical } from "lucide-react";

interface BlockEditorProps {
  initialBlocks?: Block[];
  onSave?: (blocks: Block[]) => void;
  readOnly?: boolean;
}

export default function BlockEditor({
  initialBlocks = [],
  onSave,
  readOnly = false
}: BlockEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks.length > 0 
    ? initialBlocks 
    : [{ id: uuidv4(), type: "text", content: "" }]
  );
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [draggedOverBlockId, setDraggedOverBlockId] = useState<string | null>(null);
  const { logEvent } = useLogger();

  // Auto-save when there are unsaved changes
  useEffect(() => {
    if (unsavedChanges && onSave) {
      const saveTimeout = setTimeout(() => {
        onSave(blocks);
        setUnsavedChanges(false);
        logger.debug('editor', 'Auto-saved blocks', { blockCount: blocks.length });
      }, 1000);

      return () => clearTimeout(saveTimeout);
    }
  }, [unsavedChanges, onSave, blocks]);

  // Handle block update
  const updateBlock = useCallback((id: string, updates: Partial<Block>) => {
    setBlocks(prevBlocks => 
      prevBlocks.map(block => 
        block.id === id ? { ...block, ...updates } : block
      )
    );
    setUnsavedChanges(true);
  }, []);

  // Handle block creation
  const addBlockAfter = useCallback((id: string, type: Block["type"] = "text") => {
    const newBlockId = uuidv4();
    
    setBlocks(prevBlocks => {
      const index = prevBlocks.findIndex(block => block.id === id);
      if (index === -1) return prevBlocks;
      
      const newBlocks = [...prevBlocks];
      newBlocks.splice(index + 1, 0, {
        id: newBlockId,
        type,
        content: ""
      });
      
      return newBlocks;
    });
    
    // Focus the new block after render
    setTimeout(() => {
      setActiveBlockId(newBlockId);
      document.getElementById(`block-${newBlockId}`)?.focus();
    }, 0);
    
    logEvent('editor', 'add_block', { type });
    setUnsavedChanges(true);
  }, [logEvent]);

  // Handle block deletion
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
      }, 0);
      
      return newBlocks;
    });
    
    logEvent('editor', 'delete_block', { blockId: id });
    setUnsavedChanges(true);
  }, [blocks.length, logEvent]);

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
    else if (e.key === "ArrowUp" && index > 0) {
      e.preventDefault();
      const prevBlockId = blocks[index - 1].id;
      setActiveBlockId(prevBlockId);
      document.getElementById(`block-${prevBlockId}`)?.focus();
    }
    else if (e.key === "ArrowDown" && index < blocks.length - 1) {
      e.preventDefault();
      const nextBlockId = blocks[index + 1].id;
      setActiveBlockId(nextBlockId);
      document.getElementById(`block-${nextBlockId}`)?.focus();
    }
  }, [blocks, addBlockAfter, deleteBlock]);

  // Change block type
  const changeBlockType = useCallback((id: string, newType: Block["type"]) => {
    updateBlock(id, { type: newType });
    logEvent('editor', 'change_block_type', { to: newType });
  }, [updateBlock, logEvent]);

  // Drag and drop handlers
  const reorderBlocks = useCallback((startIndex: number, endIndex: number) => {
    const result = Array.from(blocks);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    setBlocks(result);
    setUnsavedChanges(true);
  }, [blocks]);

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedBlockId(id);
    
    // This trick helps with the drag preview
    setTimeout(() => {
      const element = document.getElementById(`block-${id}`);
      if (element) {
        element.classList.add('opacity-50');
      }
    }, 0);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedBlockId(null);
    setDraggedOverBlockId(null);
    
    blocks.forEach(block => {
      const element = document.getElementById(`block-${block.id}`);
      if (element) {
        element.classList.remove('opacity-50');
        element.classList.remove('border-t-2', 'border-blue-500');
      }
    });
  }, [blocks]);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (id !== draggedOverBlockId) {
      setDraggedOverBlockId(id);
    }
  }, [draggedOverBlockId]);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    
    const sourceId = e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId) return;
    
    const sourceIndex = blocks.findIndex(b => b.id === sourceId);
    const targetIndex = blocks.findIndex(b => b.id === targetId);
    
    if (sourceIndex !== -1 && targetIndex !== -1) {
      reorderBlocks(sourceIndex, targetIndex);
    }
    
    handleDragEnd();
  }, [blocks, reorderBlocks, handleDragEnd]);

  // Render a block
  const renderBlock = useCallback((block: Block) => {
    const isActive = activeBlockId === block.id;
    const blockRef = useRef<HTMLDivElement>(null);
    const [isEmpty, setIsEmpty] = useState(!block.content);
    
    // Common block styles
    const blockBaseClass = `
      w-full p-2 rounded-md
      ${isActive ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}
      transition-colors outline-none
    `;
    
    // Type-specific styles
    let blockClass = blockBaseClass;
    let placeholder = "Type something...";
    
    switch (block.type) {
      case "heading":
        blockClass += " text-xl font-bold";
        placeholder = "Heading";
        break;
      case "todo":
        placeholder = "To-do item";
        break;
      case "code":
        blockClass += " font-mono bg-gray-100 dark:bg-gray-800";
        placeholder = "// Code block";
        break;
      case "list":
        placeholder = "List item";
        break;
    }
    
    // Monitor content changes to update isEmpty state
    useEffect(() => {
      setIsEmpty(!block.content);
    }, [block.content]);
    
    // Set up the placeholder effect
    useEffect(() => {
      if (blockRef.current) {
        if (isEmpty && !isActive) {
          // Show placeholder when empty and not focused
          blockRef.current.dataset.placeholder = placeholder;
        } else {
          // Remove placeholder when has content or is focused
          delete blockRef.current.dataset.placeholder;
        }
      }
    }, [isEmpty, isActive, placeholder]);
    
    return (
      <div 
        className="group relative flex mb-1" 
        draggable={!readOnly}
        onDragStart={(e) => handleDragStart(e, block.id)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => handleDragOver(e, block.id)}
        onDrop={(e) => handleDrop(e, block.id)}
        data-is-dragged-over={draggedOverBlockId === block.id}
      >
        {/* Drag Handle */}
        <div className="absolute left-0 top-2 -ml-8 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
          <GripVertical size={16} className="text-gray-400" />
        </div>
        
        {/* Block Type Icon */}
        <div className="absolute left-0 top-2 -ml-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center">
          {block.type === "todo" ? (
            <Check 
              size={16} 
              className={`cursor-pointer ${
                block.properties?.checked 
                  ? "text-green-500" 
                  : "text-gray-400"
              }`}
              onClick={() => {
                if (block.type === "todo") {
                  updateBlock(block.id, { 
                    properties: { 
                      ...block.properties, 
                      checked: !(block.properties?.checked) 
                    } 
                  });
                }
              }}
            />
          ) : (
            <div className="w-4 h-4"></div> // Spacer
          )}
        </div>
        
        {/* Block Type Selector */}
        <div className="absolute right-0 top-2 -mr-8 opacity-0 group-hover:opacity-100 transition-opacity flex-col items-center space-y-1 hidden md:flex">
          <Type
            size={14}
            className="cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={() => changeBlockType(block.id, "text")}
            title="Text"
          />
          <Heading
            size={14}
            className="cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={() => changeBlockType(block.id, "heading")}
            title="Heading"
          />
          <List
            size={14}
            className="cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={() => changeBlockType(block.id, "list")}
            title="List"
          />
          <Check
            size={14}
            className="cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={() => changeBlockType(block.id, "todo")}
            title="To-do"
          />
          <Code
            size={14}
            className="cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={() => changeBlockType(block.id, "code")}
            title="Code"
          />
          <Mic
            size={14}
            className="cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            onClick={() => changeBlockType(block.id, "audio")}
            title="Voice Note"
          />
        </div>
        
        {/* Actual Editable Content */}
        {block.type === "todo" ? (
          <div className="flex items-center w-full">
            <input
              type="checkbox"
              checked={!!block.properties?.checked}
              onChange={() => {
                updateBlock(block.id, { 
                  properties: { 
                    ...block.properties, 
                    checked: !(block.properties?.checked) 
                  } 
                });
              }}
              className="mr-2 h-4 w-4 rounded border-gray-300"
            />
            <div
              ref={blockRef}
              id={`block-${block.id}`}
              contentEditable={!readOnly}
              suppressContentEditableWarning
              className={`${blockClass} flex-1 ${block.properties?.checked ? 'line-through text-gray-500' : ''} empty:before:text-gray-400 empty:before:content-[attr(data-placeholder)] empty:before:pointer-events-none`}
              onInput={(e) => updateBlock(block.id, { content: e.currentTarget.textContent || "" })}
              onFocus={() => setActiveBlockId(block.id)}
              onBlur={() => setActiveBlockId(null)}
              onKeyDown={(e) => handleBlockKeyDown(e, block.id)}
              dangerouslySetInnerHTML={{ __html: block.content || "" }}
            />
          </div>
        ) : (
          <div
            ref={blockRef}
            id={`block-${block.id}`}
            contentEditable={!readOnly}
            suppressContentEditableWarning
            className={`${blockClass} empty:before:text-gray-400 empty:before:content-[attr(data-placeholder)] empty:before:pointer-events-none`}
            onInput={(e) => updateBlock(block.id, { content: e.currentTarget.textContent || "" })}
            onFocus={() => setActiveBlockId(block.id)}
            onBlur={() => setActiveBlockId(null)}
            onKeyDown={(e) => handleBlockKeyDown(e, block.id)}
            dangerouslySetInnerHTML={{ __html: block.content || "" }}
          />
        )}
      </div>
    );
  }, [activeBlockId, readOnly, updateBlock, handleBlockKeyDown, changeBlockType, draggedOverBlockId, handleDragStart, handleDragEnd, handleDragOver, handleDrop]);

  return (
    <div className="w-full">
      {blocks.map(block => (
        <React.Fragment key={block.id}>
          {renderBlock(block)}
        </React.Fragment>
      ))}
    </div>
  );
}