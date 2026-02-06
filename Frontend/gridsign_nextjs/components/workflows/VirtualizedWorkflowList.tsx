"use client";
import React, { useRef, useState, useLayoutEffect, useCallback } from 'react';
import { formatDateDDMMYYYY } from '@/lib/utils';
import { Eye, User, Play, Square, Trash2 } from 'lucide-react';
import SigningModeBadge from './SigningModeBadge';
import { Button } from '@/components/ui/button';

export interface VirtualWorkflowRow {
  id: string;
  workflowName: string;
  templateName: string;
  creator: string;
  status: string;
  createdDate: string;
  updatedDate: string;
  validUntil?: string;
  daysRemaining?: number;
  isExpired?: boolean;
  isSequentialSigningEnabled?: boolean;
}

interface Props {
  items: VirtualWorkflowRow[];
  highlight?: (text: string) => React.ReactNode;
  onView: (id: string) => void;
  onUseTemplate?: (workflow: VirtualWorkflowRow) => void; // optional handler to start new workflow from template context
  onStart?: (id: string) => void;
  onStop?: (id: string) => void;
  rowHeight?: number;
  overscan?: number;
  onDelete?: (id: string) => void; // request deletion
}

const statusClass: Record<string, string> = {
  completed: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  'in-progress': 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  failed: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  cancelled: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  draft: 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
};

const VirtualizedWorkflowList: React.FC<Props> = ({ items, highlight, onView, onUseTemplate, onStart, onStop, onDelete, rowHeight = 60, overscan = 6 }) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const resizeObserver = new ResizeObserver(() => {
      setViewportHeight(el.clientHeight);
    });
    resizeObserver.observe(el);
    setViewportHeight(el.clientHeight);
    return () => resizeObserver.disconnect();
  }, []);

  const onScroll = useCallback(() => {
    if (!scrollRef.current) return;
    setScrollTop(scrollRef.current.scrollTop);
  }, []);

  const total = items.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(total - 1, Math.floor((scrollTop + viewportHeight) / rowHeight) + overscan);
  const visible = items.slice(startIndex, endIndex + 1);

  return (
    <div className="flex flex-col gap-3">
      <div ref={scrollRef} onScroll={onScroll} className="relative w-full border rounded-md border-border overflow-auto max-h-[55vh] bg-background/60 backdrop-blur">
        <div style={{ height: total * rowHeight }} className="relative w-full">
          {visible.map((wf, i) => {
            const index = startIndex + i;
            return (
              <div
                key={wf.id}
                style={{ transform: `translateY(${index * rowHeight}px)`, height: rowHeight }}
                className="absolute left-0 right-0 px-4 py-3 border-b border-border/60 flex items-center gap-4 text-sm bg-background/70 hover:bg-muted/40 transition-colors"
              >
                <div className="flex-1 min-w-[160px] font-medium text-sm truncate">{highlight ? highlight(wf.workflowName) : wf.workflowName}</div>
                <div className="hidden md:block min-w-[130px] text-xs text-muted-foreground truncate">{highlight ? highlight(wf.templateName) : wf.templateName}</div>
                <div className="hidden lg:flex items-center gap-1 text-xs text-muted-foreground min-w-[130px] truncate"><User className="h-3.5 w-3.5" /> {highlight ? highlight(wf.creator) : wf.creator} <SigningModeBadge className="ml-1" size="xs" isSequential={wf.isSequentialSigningEnabled} /></div>
                <div className="min-w-[90px]">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-medium border border-border/40 ${statusClass[wf.status]}`}>{wf.status}</span>
                </div>
                  <div className="hidden xl:block w-[100px] text-[10px] text-muted-foreground" title="Created Date"><span className="opacity-60">Created:</span> {formatDateDDMMYYYY(wf.createdDate)}</div>
                  <div className="hidden xl:block w-[90px] text-[10px] text-muted-foreground" title="Valid Until"><span className="opacity-60">Due:</span> {wf.validUntil ? formatDateDDMMYYYY(wf.validUntil) : '-'}</div>
                <div className="hidden xl:block w-[70px] text-[10px] text-muted-foreground">
                  {wf.daysRemaining !== undefined && (
                    wf.isExpired ? <span className="text-red-600 font-medium">Exp</span>
                    : wf.daysRemaining === 0 ? <span className="text-amber-700 font-medium">0d</span>
                    : wf.daysRemaining === 1 ? <span className="text-amber-700">1d</span>
                    : wf.daysRemaining <= 3 ? <span className="text-yellow-700">{wf.daysRemaining}d</span>
                    : <span>{wf.daysRemaining}d</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {wf.status === 'draft' && (
                    <button
                      onClick={() => onStart && onStart(wf.id)}
                      disabled={!onStart}
                      aria-label="Start workflow"
                      title="Start workflow"
                      className="h-7 w-7 inline-flex items-center justify-center rounded border border-border bg-muted/30 hover:bg-indigo-600/10 hover:text-indigo-600 disabled:opacity-40"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {wf.status === 'in-progress' && (
                    <button
                      onClick={() => onStop && onStop(wf.id)}
                      disabled={!onStop}
                      aria-label="Stop workflow"
                      title="Stop workflow"
                      className="h-7 w-7 inline-flex items-center justify-center rounded border border-border bg-muted/30 hover:bg-rose-600/10 hover:text-rose-600 disabled:opacity-40"
                    >
                      <Square className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => onView(wf.id)}
                    aria-label="View workflow"
                    title="View workflow"
                    className="h-7 w-7 inline-flex items-center justify-center rounded border border-border bg-muted/30 hover:bg-primary/10 hover:text-primary"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                  {onDelete && ['draft','completed','cancelled'].includes(wf.status) && (
                    <button
                      onClick={() => onDelete(wf.id)}
                      aria-label="Delete workflow"
                      title="Delete workflow"
                      className="h-7 w-7 inline-flex items-center justify-center rounded border border-border bg-muted/30 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="text-[10px] text-muted-foreground flex items-center justify-between">
        <span>Total: {total}</span>
        <span>Visible: {visible.length} (rows {startIndex + 1} - {endIndex + 1})</span>
      </div>
    </div>
  );
};

export default VirtualizedWorkflowList;
