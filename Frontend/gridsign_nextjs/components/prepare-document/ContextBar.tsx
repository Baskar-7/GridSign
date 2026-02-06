"use client";
import React from 'react';
import { Button } from '@/components/ui/button';
import { Field } from './DocumentFieldMapper';
import { Undo2, Redo2, Trash2, Check } from 'lucide-react';
import { iconBtn } from './actionButtonStyles';

interface ContextBarProps {
  selectedField: Field | null;
  pendingFieldType: string | null;
  setPendingFieldType: (type: string | null) => void;
  // Editing callbacks removed; toolbar now only handles zoom/history & field type selection.
  zoom: number;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  fieldTypes: string[];
  recipientOptions: { id: string; name: string; color: string }[];
  numPages?: number;
  // Show full editing controls in dock (when tools drawer is hidden)
  showEditingControls: boolean;
  onDuplicateField?: () => void;
  onRemoveField?: () => void;
  onDonePlacement?: () => void;
  onChangeFieldType?: (type: string) => void;
  onChangeRecipient?: (recipientId: string) => void;
  onChangePage?: (page: number) => void;
  onChangeSize?: (width: number, height: number) => void;
  onToggleRequired?: () => void;
}

export const ContextBar: React.FC<ContextBarProps> = ({
  selectedField,
  pendingFieldType,
  setPendingFieldType,
  zoom,
  zoomIn,
  zoomOut,
  resetZoom,
  canUndo,
  canRedo,
  undo,
  redo,
  fieldTypes,
  recipientOptions,
  numPages = 0,
  showEditingControls,
  onDuplicateField,
  onRemoveField,
  onDonePlacement,
  onChangeFieldType,
  onChangeRecipient,
  onChangePage,
  onChangeSize,
  onToggleRequired,
}) => {
  return (
    <div className="fixed top-0 left-1/2 -translate-x-1/2 z-30 mt-2 rounded-xl bg-gradient-to-r from-background/80 via-background/70 to-background/80 backdrop-blur-sm border border-border/30 shadow-[0_2px_6px_-1px_rgba(0,0,0,0.15)] ring-1 ring-border/20">
  <div className="px-3 py-2 flex items-center gap-2 overflow-x-auto whitespace-nowrap">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" onClick={zoomOut} aria-label="Zoom Out">-</Button>
          <span className="text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="outline" size="sm" onClick={zoomIn} aria-label="Zoom In">+</Button>
          <Button variant="secondary" size="sm" onClick={resetZoom} aria-label="Reset Zoom">Reset</Button>
        </div>
        <div className="h-6 w-px bg-border mx-1" />
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" disabled={!canUndo} onClick={undo} aria-label="Undo" title="Undo">
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" disabled={!canRedo} onClick={redo} aria-label="Redo" title="Redo">
            <Redo2 className="w-4 h-4" />
          </Button>
        </div>
        <div className="h-6 w-px bg-border mx-1" />
        <div className="flex items-center gap-4 overflow-x-auto whitespace-nowrap relative">
          {!showEditingControls && !selectedField && (
            <div className="flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-200" key="dock-types">
              {fieldTypes.map(t => (
                <Button
                  key={t}
                  variant={pendingFieldType === t ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPendingFieldType(pendingFieldType === t ? null : t)}
                >{t}</Button>
              ))}
            </div>
          )}
          {showEditingControls && selectedField && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200" key="dock-editing">
              <select
                className="text-[11px] border border-border rounded px-2 py-1 bg-background"
                value={selectedField.fieldType}
                onChange={(e) => onChangeFieldType?.(e.target.value)}
              >
                {fieldTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select
                className="text-[11px] border border-border rounded px-2 py-1 bg-background"
                value={selectedField.recipientId}
                onChange={(e) => onChangeRecipient?.(e.target.value)}
              >
                {recipientOptions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              {numPages > 1 && (
                <select
                  className="text-[11px] border border-border rounded px-2 py-1 bg-background"
                  value={selectedField.page}
                  onChange={(e) => onChangePage?.(parseInt(e.target.value,10))}
                >
                  {Array.from({ length: numPages }, (_, i) => i + 1).map(p => <option key={p} value={p}>Pg {p}</option>)}
                </select>
              )}
              <div className="flex items-center gap-1" title="Size (W×H)">
                <input
                  type="number"
                  className="w-14 text-[11px] border border-border rounded px-1 py-1 bg-background"
                  min={20}
                  value={Math.round(selectedField.width)}
                  onChange={(e) => onChangeSize?.(parseInt(e.target.value,10)||selectedField.width, selectedField.height)}
                />
                <span className="text-[10px] text-muted-foreground">×</span>
                <input
                  type="number"
                  className="w-14 text-[11px] border border-border rounded px-1 py-1 bg-background"
                  min={20}
                  value={Math.round(selectedField.height)}
                  onChange={(e) => onChangeSize?.(selectedField.width, parseInt(e.target.value,10)||selectedField.height)}
                />
              </div>
              <button
                type="button"
                onClick={() => onRemoveField?.()}
                aria-label="Remove Field"
                title="Remove Field"
                className={iconBtn('destructive')}
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onDonePlacement?.()}
                aria-label="Done Editing"
                title="Done Editing"
                className={iconBtn('success')}
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
