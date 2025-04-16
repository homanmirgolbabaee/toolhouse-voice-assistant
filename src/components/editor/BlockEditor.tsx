// components/editor/BlockEditor.tsx
"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { v4 as uuidv4 } from "uuid";
import { Block, BlockType } from "@/models/document";
import logger from "@/utils/logger";
import { useLogger } from "@/contexts/LoggerContext";
import {
  GripVertical, Trash2, MoreVertical, Edit, Copy, Plus,
  ChevronDown, ChevronUp, PlusCircle
} from "lucide-react";
import BlockMenu from "@/components/editor/BlockMenu";
import CodeBlock from "@/components/editor/blocks/CodeBlock";
import HeadingBlock from "@/components/editor/blocks/HeadingBlock";
import TodoBlock from "@/components/editor/blocks/TodoBlock";
import VoiceNoteBlock from "@/components/editor/blocks/VoiceNoteBlock";
import TextBlock from "@/components/editor/blocks/TextBlock";

interface BlockEditorProps {
  initialBlocks: Block[];
  onSave?: (blocks: Block[]) => void;
  readOnly?: boolean;
  documentId?: string;
  onDeleteDocument?: () => void;
}

export default function BlockEditor({
  initialBlocks = [],
  onSave,
  readOnly = false,
  documentId,
  onDeleteDocument
}: BlockEditorProps) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks.length > 0
    ? initialBlocks
    : [{ id: uuidv4(), type: "text", content: "" }]
  );
  const [activeBlockId, setActiveBlockId] = useState<string | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [draggedOverBlockId, setDraggedOverBlockId] = useState<string | null>(null);
  const [showDocumentMenu, setShowDocumentMenu] = useState(false);
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [blockMenuPosition, setBlockMenuPosition] = useState({ x: 0, y: 0 });
  const [blockMenuTargetId, setBlockMenuTargetId] = useState<string | null>(null);
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<string>>(new Set());

  const { logEvent } = useLogger();

  const menuRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const isUndoRedoOperation = useRef(false);
  const undoStack = useRef<Block[][]>([]);
  const redoStack = useRef<Block[][]>([]);

  // --- Core Block Operations ---
  const pushUndoState = useCallback(() => {
    if (!isUndoRedoOperation.current) {
      undoStack.current.push([...blocks]);
      redoStack.current = []; // Clear redo stack on new action
    }
  }, [blocks]);

  const updateBlock = useCallback((id: string, updates: Partial<Block>) => {
    pushUndoState();
    setBlocks(prevBlocks =>
      prevBlocks.map(block =>
        block.id === id ? { ...block, ...updates } : block
      )
    );
    setUnsavedChanges(true);
  }, [pushUndoState]);

  const addBlockAfter = useCallback((id: string, type: BlockType = "text", properties?: any, initialContent = "") => {
    const newBlockId = uuidv4();
    pushUndoState();

    setBlocks(prevBlocks => {
      const index = prevBlocks.findIndex(block => block.id === id);
      if (index === -1) return prevBlocks;

      const newBlocks = [...prevBlocks];
      newBlocks.splice(index + 1, 0, {
        id: newBlockId,
        type,
        content: initialContent,
        properties
      });
      return newBlocks;
    });

    setTimeout(() => {
      setActiveBlockId(newBlockId);
      const newBlockElement = document.getElementById(`block-${newBlockId}`);
      newBlockElement?.focus();
    }, 10);

    // Use setTimeout to avoid setState during render
    setTimeout(() => {
      logEvent('editor', 'add_block', { type });
    }, 0);
    
    setUnsavedChanges(true);
    return newBlockId;
  }, [pushUndoState, logEvent]);

  const deleteBlock = useCallback((id: string) => {
    if (blocks.length <= 1) return;

    pushUndoState();
    let focusTargetId: string | null = null;

    setBlocks(prevBlocks => {
      const index = prevBlocks.findIndex(block => block.id === id);
      if (index === -1) return prevBlocks;

      const newBlocks = [...prevBlocks];
      newBlocks.splice(index, 1);

      if (newBlocks.length > 0) {
        const focusIndex = Math.max(0, index - 1);
        focusTargetId = newBlocks[focusIndex].id;
      }
      return newBlocks;
    });

    if (focusTargetId) {
      setTimeout(() => {
        setActiveBlockId(focusTargetId);
        document.getElementById(`block-${focusTargetId}`)?.focus();
      }, 10);
    } else {
      setActiveBlockId(null);
    }

    // Use setTimeout to avoid setState during render
    setTimeout(() => {
      logEvent('editor', 'delete_block', { blockId: id });
    }, 0);
    
    setUnsavedChanges(true);
  }, [blocks.length, pushUndoState, logEvent]);

  const changeBlockType = useCallback((id: string, newType: BlockType, properties?: any) => {
    updateBlock(id, { type: newType, properties: properties || {} });
    
    // Use setTimeout to avoid setState during render
    setTimeout(() => {
      logEvent('editor', 'change_block_type', { to: newType });
    }, 0);

    setTimeout(() => {
      const blockElement = document.getElementById(`block-${id}`);
      blockElement?.focus();
    }, 10);
  }, [updateBlock, logEvent]);

  const duplicateBlock = useCallback((blockId: string) => {
    const blockToDuplicate = blocks.find(block => block.id === blockId);
    if (!blockToDuplicate) return;

    pushUndoState();
    const newBlockId = uuidv4();

    setBlocks(prevBlocks => {
      const index = prevBlocks.findIndex(block => block.id === blockId);
      if (index === -1) return prevBlocks;

      const newBlocks = [...prevBlocks];
      const duplicatedProperties = blockToDuplicate.properties ? JSON.parse(JSON.stringify(blockToDuplicate.properties)) : undefined;

      newBlocks.splice(index + 1, 0, {
        id: newBlockId,
        type: blockToDuplicate.type,
        content: blockToDuplicate.content,
        properties: duplicatedProperties
      });
      return newBlocks;
    });

    setUnsavedChanges(true);
    
    // Use setTimeout to avoid setState during render
    setTimeout(() => {
      logEvent('editor', 'duplicate_block', { type: blockToDuplicate.type });
    }, 0);

    setTimeout(() => {
      setActiveBlockId(newBlockId);
      document.getElementById(`block-${newBlockId}`)?.focus();
    }, 10);
  }, [blocks, pushUndoState, logEvent]);

  // Undo/Redo operations
  const undo = useCallback(() => {
    if (undoStack.current.length > 0) {
      const previousState = undoStack.current.pop();
      if (previousState) {
        redoStack.current.push([...blocks]);

        isUndoRedoOperation.current = true;
        setBlocks(previousState);
        setUnsavedChanges(true);

        setTimeout(() => { isUndoRedoOperation.current = false; }, 0);
        
        // Use setTimeout to avoid setState during render
        setTimeout(() => {
          logEvent('editor', 'undo');
        }, 0);
      }
    }
  }, [blocks, logEvent]);

  const redo = useCallback(() => {
    if (redoStack.current.length > 0) {
      const nextState = redoStack.current.pop();
      if (nextState) {
        undoStack.current.push([...blocks]);

        isUndoRedoOperation.current = true;
        setBlocks(nextState);
        setUnsavedChanges(true);

        setTimeout(() => { isUndoRedoOperation.current = false; }, 0);
        
        // Use setTimeout to avoid setState during render
        setTimeout(() => {
          logEvent('editor', 'redo');
        }, 0);
      }
    }
  }, [blocks, logEvent]);

  // Block movement and drag-drop operations
  const reorderBlocks = useCallback((startIndex: number, endIndex: number) => {
    pushUndoState();
    const result = Array.from(blocks);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    setBlocks(result);
    setUnsavedChanges(true);
    logger.debug('editor', `Reordered blocks from index ${startIndex} to ${endIndex}`);
  }, [blocks, pushUndoState]);

  // Utility functions for block movement
  const moveBlockUp = useCallback((blockId: string) => {
    const index = blocks.findIndex(block => block.id === blockId);
    if (index > 0) reorderBlocks(index, index - 1);
  }, [blocks, reorderBlocks]);

  const moveBlockDown = useCallback((blockId: string) => {
    const index = blocks.findIndex(block => block.id === blockId);
    if (index !== -1 && index < blocks.length - 1) reorderBlocks(index, index + 1);
  }, [blocks, reorderBlocks]);

  // Block Menu Operations
  const openBlockMenu = useCallback((elementOrPosition: HTMLElement | { clientX: number, clientY: number }, blockId: string) => {
    let x: number;
    let y: number;

    // If we're using an element to position (e.g., when using the slash command)
    if ('getBoundingClientRect' in elementOrPosition) {
      const rect = elementOrPosition.getBoundingClientRect();
      x = rect.left;
      y = rect.bottom + window.scrollY;
    } else {
      // Direct position coordinates provided
      x = elementOrPosition.clientX;
      y = elementOrPosition.clientY;
    }

    // Set the menu position and target block ID
    setBlockMenuPosition({ x, y });
    setBlockMenuTargetId(blockId);
    setShowBlockMenu(true);
  }, []);

  const handleBlockTypeSelect = useCallback((type: BlockType, properties?: any) => {
    if (blockMenuTargetId) {
      const targetBlock = blocks.find(b => b.id === blockMenuTargetId);
      if (targetBlock) {
        if (targetBlock.content === '' && showBlockMenu) {
          changeBlockType(blockMenuTargetId, type, properties);
        } else {
          changeBlockType(blockMenuTargetId, type, properties);
        }
      }
    }
    setShowBlockMenu(false);
    setBlockMenuTargetId(null);
  }, [blockMenuTargetId, blocks, changeBlockType, showBlockMenu]);

  // Block Collapsing
  const toggleBlockCollapse = useCallback((id: string) => {
    setCollapsedBlocks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
        // Move logEvent outside of setState to avoid setState during render
        setTimeout(() => {
          logEvent('editor', 'expand_block', { blockId: id });
        }, 0);
      } else {
        newSet.add(id);
        // Move logEvent outside of setState to avoid setState during render
        setTimeout(() => {
          logEvent('editor', 'collapse_block', { blockId: id });
        }, 0);
      }
      return newSet;
    });
  }, [logEvent]);

  // Block Actions Menu Component
  const BlockActionsMenu = useCallback(({ block }: { block: Block }) => {
    const [showMenu, setShowMenu] = useState(false);
    const actionMenuRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Click outside listener
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node) &&
            buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
          setShowMenu(false);
        }
      };
      if (showMenu) {
        document.addEventListener("mousedown", handleClickOutside);
      }
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [showMenu]);

    const handleOpenBlockTypeMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      // If we have a button reference, use it directly for positioning
      if (buttonRef.current) {
        openBlockMenu(buttonRef.current, block.id);
      } else {
        // Fallback to using mouse coordinates
        openBlockMenu({ 
          clientX: e.clientX, 
          clientY: e.clientY 
        }, block.id);
      }
      setShowMenu(false);
    };

    const index = blocks.findIndex(b => b.id === block.id);
    const canMoveUp = index > 0;
    const canMoveDown = index < blocks.length - 1;
    const canDelete = blocks.length > 1;

    return (
      <div className="relative" style={{ visibility: readOnly ? 'hidden' : 'visible' }}>
        <button
          ref={buttonRef}
          onClick={() => setShowMenu(!showMenu)}
          className="ml-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-gray-700 focus:opacity-100 transition-opacity focus:outline-none focus:ring-1 focus:ring-blue-500"
          aria-label="Block options"
          aria-haspopup="true"
          aria-expanded={showMenu}
        >
          <MoreVertical size={16} className="text-gray-500 dark:text-gray-400" />
        </button>

        {showMenu && (
          <div
            ref={actionMenuRef}
            className="absolute right-0 top-full mt-1 z-50 w-48 bg-white dark:bg-gray-800 shadow-lg rounded-md border border-gray-200 dark:border-gray-700 py-1"
            role="menu" aria-orientation="vertical" aria-labelledby={buttonRef.current?.id || undefined}
          >
            <button
              role="menuitem"
              className="flex items-center w-full px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={handleOpenBlockTypeMenu}
            >
              <Edit size={14} className="mr-2" /> Change type...
            </button>
            <button
              role="menuitem"
              className="flex items-center w-full px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              onClick={() => { duplicateBlock(block.id); setShowMenu(false); }}
            >
              <Copy size={14} className="mr-2" /> Duplicate
            </button>
            <div className="my-1 border-t border-gray-200 dark:border-gray-700"></div>
            <button
              role="menuitem"
              className="flex items-center w-full px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => { moveBlockUp(block.id); setShowMenu(false); }}
              disabled={!canMoveUp}
            >
              <ChevronUp size={14} className="mr-2" /> Move up
            </button>
            <button
              role="menuitem"
              className="flex items-center w-full px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => { moveBlockDown(block.id); setShowMenu(false); }}
              disabled={!canMoveDown}
            >
              <ChevronDown size={14} className="mr-2" /> Move down
            </button>
            <div className="my-1 border-t border-gray-200 dark:border-gray-700"></div>
            <button
              role="menuitem"
              className="flex items-center w-full px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => { deleteBlock(block.id); setShowMenu(false); }}
              disabled={!canDelete}
            >
              <Trash2 size={14} className="mr-2" /> Delete
            </button>
          </div>
        )}
      </div>
    );
  }, [
    readOnly, blocks, deleteBlock, duplicateBlock, 
    moveBlockDown, moveBlockUp, openBlockMenu
  ]);

  // Drag and Drop Handlers
  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    if (readOnly) return;
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggedBlockId(id);
    setTimeout(() => {
      const element = document.getElementById(`block-wrapper-${id}`);
      element?.classList.add('opacity-50');
    }, 0);
  }, [readOnly]);

  const handleDragEnd = useCallback(() => {
    if (readOnly) return;
    blocks.forEach(block => {
      const element = document.getElementById(`block-wrapper-${block.id}`);
      element?.classList.remove('opacity-50', 'border-t-2', 'border-b-2', 'border-blue-500');
    });
    setDraggedBlockId(null);
    setDraggedOverBlockId(null);
  }, [blocks, readOnly]);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    if (readOnly || !draggedBlockId || draggedBlockId === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (id !== draggedOverBlockId) {
      if (draggedOverBlockId) {
        const prevElement = document.getElementById(`block-wrapper-${draggedOverBlockId}`);
        prevElement?.classList.remove('border-t-2', 'border-b-2', 'border-blue-500');
      }

      setDraggedOverBlockId(id);
      const targetElement = document.getElementById(`block-wrapper-${id}`);
      const targetRect = targetElement?.getBoundingClientRect();
      if (targetElement && targetRect) {
        const hoverMiddleY = targetRect.top + targetRect.height / 2;
        if (e.clientY < hoverMiddleY) {
          targetElement.classList.add('border-t-2', 'border-blue-500');
          targetElement.classList.remove('border-b-2');
        } else {
          targetElement.classList.add('border-b-2', 'border-blue-500');
          targetElement.classList.remove('border-t-2');
        }
      }
    }
  }, [readOnly, draggedBlockId, draggedOverBlockId]);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    if (readOnly || !draggedBlockId) return;
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId) {
      handleDragEnd();
      return;
    }

    const sourceIndex = blocks.findIndex(b => b.id === sourceId);
    let targetIndex = blocks.findIndex(b => b.id === targetId);

    if (sourceIndex !== -1 && targetIndex !== -1) {
      const targetElement = document.getElementById(`block-wrapper-${targetId}`);
      const targetRect = targetElement?.getBoundingClientRect();
      if (targetRect && e.clientY > targetRect.top + targetRect.height / 2) {
        targetIndex += 1;
      }
      if (sourceIndex < targetIndex) {
        targetIndex -= 1;
      }
      reorderBlocks(sourceIndex, targetIndex);
    }
    handleDragEnd();
  }, [readOnly, blocks, draggedBlockId, reorderBlocks, handleDragEnd]);

  // Keyboard Event Handlers
  const handleGlobalKeyDown = useCallback((e: KeyboardEvent) => {
    if (!editorRef.current?.contains(document.activeElement)) return;

    // Undo/Redo
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
      return;
    }
    // Redo (alternative)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
      return;
    }

    // Manual Save
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's' && onSave && !readOnly) {
      e.preventDefault();
      onSave(blocks);
      setUnsavedChanges(false);
      logger.info('editor', 'Manual save triggered');
      return;
    }
  }, [undo, redo, onSave, blocks, readOnly]);

  const handleBlockKeyDown = useCallback((e: React.KeyboardEvent, blockId: string) => {
    if (readOnly) return;

    const index = blocks.findIndex(block => block.id === blockId);
    if (index === -1) return;
    const currentBlock = blocks[index];

    // Enter key: Add new block below
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      addBlockAfter(blockId);
    }
    // Backspace key: Delete block if empty
    else if (e.key === "Backspace") {
      const selection = window.getSelection();
      if (currentBlock.content === "" || (selection && selection.anchorOffset === 0 && selection.focusOffset === 0)) {
        e.preventDefault();
        deleteBlock(blockId);
      }
    }
    // Arrow keys: Navigate between blocks
    else if (e.key === "ArrowUp") {
      const selection = window.getSelection();
      if (index > 0 && selection && selection.anchorOffset === 0) {
        e.preventDefault();
        const prevBlockId = blocks[index - 1].id;
        setActiveBlockId(prevBlockId);
        document.getElementById(`block-${prevBlockId}`)?.focus();
      }
    }
    else if (e.key === "ArrowDown") {
      const selection = window.getSelection();
      const target = e.target as HTMLElement;
      const contentLength = target.textContent?.length ?? 0;
      if (index < blocks.length - 1 && selection && selection.anchorOffset === contentLength) {
        e.preventDefault();
        const nextBlockId = blocks[index + 1].id;
        setActiveBlockId(nextBlockId);
        document.getElementById(`block-${nextBlockId}`)?.focus();
      }
    }
  }, [readOnly, blocks, addBlockAfter, deleteBlock]);

  const handleBlockKeyUp = useCallback((e: React.KeyboardEvent, blockId: string) => {
    if (readOnly) return;

    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    // Slash command trigger
    if (e.key === '/' && block.content === '/') {
      const blockElement = document.getElementById(`block-${blockId}`);
      const contentEditable = blockElement?.querySelector<HTMLElement>('[contenteditable="true"]');
      const targetElement = contentEditable || blockElement;

      if (targetElement) {
        // Use the element directly for positioning
        openBlockMenu(targetElement, blockId);
        updateBlock(blockId, { content: '' });
      }
    }
  }, [readOnly, blocks, openBlockMenu, updateBlock]);

  // Handler for deleting the document
  const handleDeleteDocument = () => {
    if (onDeleteDocument) {
      onDeleteDocument();
    } else {
      logger.warn('editor', 'Delete document called but no handler provided');
    }
  };

  // Add block to end
  const handleAddBlockToEnd = useCallback(() => {
    if (readOnly) return;
    const lastBlock = blocks[blocks.length - 1];
    if (lastBlock) {
      addBlockAfter(lastBlock.id);
    } else {
      const newBlockId = uuidv4();
      pushUndoState();
      setBlocks([{ id: newBlockId, type: "text", content: "" }]);
      setTimeout(() => {
        setActiveBlockId(newBlockId);
        document.getElementById(`block-${newBlockId}`)?.focus();
      }, 10);
      setUnsavedChanges(true);
    }
  }, [readOnly, blocks, addBlockAfter, pushUndoState]);

  // Render Block Logic
  const renderBlock = useCallback((block: Block) => {
    const isActive = activeBlockId === block.id;
    const isCollapsed = collapsedBlocks.has(block.id);

    const commonProps = {
      id: block.id,
      isActive,
      onFocus: () => !readOnly && setActiveBlockId(block.id),
      onBlur: () => setActiveBlockId(null),
      onKeyDown: handleBlockKeyDown,
      onKeyUp: handleBlockKeyUp,
      readOnly
    };

    switch (block.type) {
      case 'heading':
        return (
          <div className="flex items-start group">
            {!readOnly && (
              <button
                onClick={() => toggleBlockCollapse(block.id)}
                className="mr-1 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded"
                aria-label={isCollapsed ? "Expand section" : "Collapse section"}
                aria-expanded={!isCollapsed}
              >
                {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
              </button>
            )}
            <HeadingBlock
              content={block.content}
              level={block.properties?.level || 1}
              onChange={(content) => updateBlock(block.id, { content })}
              onLevelChange={(level) => updateBlock(block.id, { properties: { ...block.properties, level } })}
              {...commonProps}
            />
          </div>
        );

      case 'code':
        return (
          <CodeBlock
            content={block.content}
            language={block.properties?.language || 'plain'}
            onChange={(content) => updateBlock(block.id, { content })}
            onLanguageChange={(language) =>
              updateBlock(block.id, {
                properties: { ...block.properties, language }
              })
            }
            {...commonProps}
          />
        );

      case 'todo':
        return (
          <TodoBlock
            content={block.content}
            checked={!!block.properties?.checked}
            onChange={(content) => updateBlock(block.id, { content })}
            onCheckChange={(checked) =>
              updateBlock(block.id, {
                properties: { ...block.properties, checked }
              })
            }
            {...commonProps}
          />
        );

      case 'audio':
        return (
          <VoiceNoteBlock
            content={block.content}
            onChange={(content) => updateBlock(block.id, { content })}
            {...commonProps}
          />
        );

      case 'list':
        return (
          <div className="flex items-start group">
            <div className="w-6 flex-shrink-0 flex justify-center pt-[7px] text-gray-600 dark:text-gray-400">•</div>
            <div className="flex-1">
              <TextBlock
                content={block.content}
                onChange={(content) => updateBlock(block.id, { content })}
                {...commonProps}
              />
            </div>
          </div>
        );

      case 'text':
      default:
        return (
          <TextBlock
            content={block.content}
            onChange={(content) => updateBlock(block.id, { content })}
            {...commonProps}
          />
        );
    }
  }, [
    activeBlockId, readOnly, collapsedBlocks,
    handleBlockKeyDown, handleBlockKeyUp, 
    toggleBlockCollapse, updateBlock
  ]);

  // Effects
  useEffect(() => {
    if (readOnly || !unsavedChanges || !onSave) return;
    const saveTimeout = setTimeout(() => {
      onSave(blocks);
      setUnsavedChanges(false);
      logger.debug('editor', 'Auto-saved blocks', { count: blocks.length });
    }, 1500);
    return () => clearTimeout(saveTimeout);
  }, [readOnly, unsavedChanges, onSave, blocks]);

  useEffect(() => {
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [handleGlobalKeyDown]);

  // Render
  let collapsedLevel: number | null = null;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8" ref={editorRef}>
      {documentId && !readOnly && (
        <div className="mb-4 flex justify-end relative">
          <button
            onClick={() => setShowDocumentMenu(!showDocumentMenu)}
            className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
            aria-label="Document options"
            aria-haspopup="true"
            aria-expanded={showDocumentMenu}
          >
            <MoreVertical size={18} />
          </button>

          {showDocumentMenu && (
            <div
              ref={menuRef}
              className="absolute right-0 top-10 z-50 w-48 bg-white dark:bg-gray-800 shadow-lg rounded-md border border-gray-200 dark:border-gray-700 py-1"
              role="menu" aria-orientation="vertical"
            >
              <button
                role="menuitem"
                className="flex items-center w-full px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={handleDeleteDocument}
              >
                <Trash2 size={14} className="mr-2" /> Delete
              </button>
            </div>
          )}
        </div>
      )}

      {/* Blocks Rendering */}
      <div className="space-y-1">
        {blocks.map((block) => {
          // Collapsing Logic
          if (collapsedLevel !== null) {
            if (block.type === 'heading') {
              const currentLevel = block.properties?.level || 1;
              if (currentLevel <= collapsedLevel) {
                collapsedLevel = null;
              }
            }
            if (collapsedLevel !== null) {
              return null;
            }
          }

          // Check if the current block STARTS a new collapsed section
          const isCollapsed = collapsedBlocks.has(block.id);
          if (block.type === 'heading' && isCollapsed && collapsedLevel === null) {
            collapsedLevel = block.properties?.level || 1;
          }

          // Render the block wrapper
          return (
            <div
              key={block.id}
              id={`block-wrapper-${block.id}`}
              className={`group flex items-start gap-1 relative transition-all duration-100 ease-in-out ${draggedBlockId === block.id ? 'opacity-50' : ''}`}
              draggable={!readOnly}
              onDragStart={(e) => handleDragStart(e, block.id)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, block.id)}
              onDrop={(e) => handleDrop(e, block.id)}
            >
              {/* Drag Handle & Block Actions */}
              {!readOnly && (
                 <div className={`flex items-center h-full pt-1.5 pr-1 ${activeBlockId === block.id || draggedBlockId === block.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                     <span
                         className="cursor-grab text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                         title="Drag to move"
                     >
                         <GripVertical size={16} />
                     </span>
                 </div>
              )}

              {/* Render the actual block content */}
              <div className="flex-1 w-full">
                {renderBlock(block)}
              </div>

              {/* Block Actions Menu Trigger */}
               {!readOnly && (
                   <div className={`absolute top-0.5 right-0 flex items-center h-full ${activeBlockId === block.id || draggedBlockId === block.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                       <BlockActionsMenu block={block} />
                   </div>
               )}
            </div>
          );
        })}
      </div>

      {/* Add Block Button */}
      {!readOnly && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={handleAddBlockToEnd}
            className="flex items-center px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            aria-label="Add block at the end"
          >
            <PlusCircle size={16} className="mr-1" /> Add Block
          </button>
        </div>
      )}

      {/* Block Type Change Menu */}
      {showBlockMenu && blockMenuTargetId && (
         <div
            id="block-type-menu"
            className="fixed z-[60]"
         >
              <BlockMenu
                  onSelect={handleBlockTypeSelect}
                  onClose={() => { setShowBlockMenu(false); setBlockMenuTargetId(null); }}
                  position={blockMenuPosition}
                  filterText=""
                  onFilterChange={() => {}}
              />
         </div>
      )}
    </div>
  );
}