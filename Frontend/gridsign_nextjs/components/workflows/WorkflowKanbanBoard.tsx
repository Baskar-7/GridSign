"use client";
import React, { useState, useCallback } from 'react';
import { formatDateDDMMYYYY } from '@/lib/utils';
import { Eye, User, Play, Square, Trash2 } from 'lucide-react';
import SigningModeBadge from './SigningModeBadge';
import { Button } from '@/components/ui/button';

export interface KanbanWorkflowItem {
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
  items: KanbanWorkflowItem[];
  loading?: boolean;
  onView: (id: string) => void;
  onStatusChange?: (id: string, status: string) => void;
  onStart?: (id: string) => void;
  onStop?: (id: string) => void;
  highlight?: (text: string) => React.ReactNode;
  statuses: string[];
  onDelete?: (id: string) => void; // request deletion (draft/completed/cancelled)
}

const statusOrder = ['in-progress','draft','completed','failed','cancelled'];

const statusStyles: Record<string, { header: string; badge: string; accent: string; }> = {
  'in-progress': { header: 'from-blue-500/20 to-blue-500/5', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', accent: 'border-blue-400' },
  draft: { header: 'from-gray-500/20 to-gray-500/5', badge: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', accent: 'border-gray-400' },
  completed: { header: 'from-green-500/20 to-green-500/5', badge: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300', accent: 'border-green-500' },
  failed: { header: 'from-red-500/25 to-red-500/5', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', accent: 'border-red-500' },
  cancelled: { header: 'from-red-400/25 to-red-400/5', badge: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300', accent: 'border-red-400' },
};

const WorkflowKanbanBoard: React.FC<Props> = ({ items, loading, onView, onStatusChange, onStart, onStop, highlight, statuses, onDelete }) => {
  const [dragId, setDragId] = useState<string | null>(null);

  const byStatus: Record<string, KanbanWorkflowItem[]> = {};
  statuses.forEach(s => { byStatus[s] = []; });
  items.forEach(i => { if (!byStatus[i.status]) byStatus[i.status] = []; byStatus[i.status].push(i); });

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault();
    if (dragId && onStatusChange) onStatusChange(dragId, status);
    setDragId(null);
  };

  const renderCard = useCallback((wf: KanbanWorkflowItem) => {
    const daysBadge = () => {
      if (wf.daysRemaining === undefined) return null;
      if (wf.isExpired) return <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200 text-[9px] font-medium dark:bg-neutral-900/30 dark:text-neutral-300 dark:border-neutral-700">Expired</span>;
      if (wf.daysRemaining === 0) return <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-medium dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700">Today</span>;
      if (wf.daysRemaining === 1) return <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-medium">1d</span>;
      if ((wf.daysRemaining ?? 0) <= 3) return <span className="px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 border border-yellow-200 text-[9px] font-medium">{wf.daysRemaining}d</span>;
      return <span className="px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground border border-border/50 text-[9px] font-medium">{wf.daysRemaining}d</span>;
    };
    return (
      <div
        key={wf.id}
        draggable
        onDragStart={(e) => handleDragStart(e, wf.id)}
        className="group relative rounded-lg border border-border bg-background/70 backdrop-blur px-3 py-2 flex flex-col gap-2 shadow-sm hover:shadow-md cursor-grab active:cursor-grabbing transition"
      >
        <div className="flex items-start justify-between gap-1">
          <h4 className="text-[11px] font-semibold leading-tight max-w-[70%] truncate" title={wf.workflowName}>
            {highlight ? highlight(wf.workflowName) : wf.workflowName}
          </h4>
          <span className="text-[9px] font-mono text-muted-foreground shrink-0">{wf.id.split('-').pop()}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px]">
          <p className="text-muted-foreground truncate flex-1" title={wf.templateName}>{highlight ? highlight(wf.templateName) : wf.templateName}</p>
          <div className="shrink-0" title={wf.isSequentialSigningEnabled ? 'Sequential signing' : 'Parallel signing'}>
            <SigningModeBadge isSequential={wf.isSequentialSigningEnabled} />
          </div>
        </div>
        <div className="flex items-center justify-between text-[9px] text-muted-foreground mt-0.5">
          <span className="flex items-center gap-1 max-w-[60%] truncate" title={wf.creator}><User className="h-3 w-3" /> {highlight ? highlight(wf.creator) : wf.creator}</span>
          {daysBadge()}
        </div>
        {wf.validUntil && (
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground" title="Valid Until">
            <span className="opacity-70">Due:</span>
            <span className={wf.isExpired ? 'text-neutral-700 font-medium' : ''}>{formatDateDDMMYYYY(wf.validUntil)}</span>
          </div>
        )}
        <div className="mt-1 flex items-center justify-center gap-1 flex-wrap">
          {wf.status === 'draft' && (
            <Button
              size="sm"
              title="Start workflow"
              aria-label="Start workflow"
              className="h-6 px-2 flex items-center gap-1 rounded-md bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-500 hover:to-blue-500 focus-visible:ring-2 focus-visible:ring-indigo-400/50"
              onClick={() => onStart && onStart(wf.id)}
            >
              <Play className="h-3.5 w-3.5" />
              <span className="text-[9px] font-medium leading-none">Start</span>
            </Button>
          )}
          {wf.status === 'in-progress' && (
            <Button
              size="sm"
              title="Stop workflow"
              aria-label="Stop workflow"
              className="h-6 px-2 flex items-center gap-1 rounded-md bg-gradient-to-r from-rose-600 to-red-600 text-white hover:from-rose-500 hover:to-red-500 focus-visible:ring-2 focus-visible:ring-rose-400/50"
              onClick={() => onStop && onStop(wf.id)}
            >
              <Square className="h-3.5 w-3.5" />
              <span className="text-[9px] font-medium leading-none">Stop</span>
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            title="View workflow"
            aria-label="View workflow"
            className="h-6 px-2 flex items-center gap-1 hover:bg-indigo-50 hover:text-indigo-700"
            onClick={() => onView(wf.id)}
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="text-[9px] font-medium leading-none">View</span>
          </Button>
          {onDelete && ['draft','completed','cancelled'].includes(wf.status) && (
            <Button
              size="sm"
              variant="outline"
              title="Delete workflow"
              aria-label="Delete workflow"
              className="h-6 px-2 flex items-center gap-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
              onClick={() => onDelete(wf.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="text-[9px] font-medium leading-none">Delete</span>
            </Button>
          )}
        </div>
      </div>
    );
  }, [highlight, onView, onDelete]);

  if (loading) {
    return (
      <div className="grid grid-cols-5 gap-4">
        {statusOrder.map(col => (
          <div key={col} className="flex flex-col gap-3">
            <div className="h-10 rounded-md bg-muted/40 animate-pulse" />
            {[...Array(3)].map((_,i) => <div key={i} className="h-20 rounded-md bg-muted/30 animate-pulse" />)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${statuses.length}, minmax(0,1fr))` }}>
      {statuses.map(status => {
        const style = statusStyles[status] || statusStyles['draft'];
        const list = byStatus[status] || [];
        return (
          <div
            key={status}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, status)}
            className="flex flex-col gap-3 min-h-[300px]"
          >
            <div className={`rounded-md px-3 py-2 text-xs font-semibold bg-gradient-to-r ${style.header} border border-border flex items-center justify-between`}> 
              <span className="capitalize">{status.replace('-', ' ')}</span>
              <span className="text-[10px] text-muted-foreground">{list.length}</span>
            </div>
            <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-2 overflow-y-auto min-h-[240px] max-h-[480px]">
              {list.length === 0 ? (
                <div className="text-[10px] text-muted-foreground italic opacity-70">Empty</div>
              ) : list.map(renderCard)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default WorkflowKanbanBoard;
