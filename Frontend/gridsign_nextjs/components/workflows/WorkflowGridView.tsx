"use client";
import React, { useState } from 'react';
import { formatDateDDMMYYYY } from '@/lib/utils';
import { Eye, User, FileText, Play, Square, Trash2, AlertTriangle } from 'lucide-react';
import SigningModeBadge from './SigningModeBadge';
import { Button } from '@/components/ui/button';

export interface WorkflowGridItem {
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
  items: WorkflowGridItem[];
  loading?: boolean;
  onView: (id: string) => void;
  onStart?: (id: string) => void; // start a draft workflow
  onStop?: (id: string) => void;  // stop / cancel an in-progress workflow
  onDelete?: (id: string) => Promise<void> | void; // delete workflow (draft/completed/cancelled)
  highlight?: (text: string) => React.ReactNode;
}

// Enhanced gradient-based status colors for premium aesthetic
const statusColors: Record<string, { bg: string; text: string; ring: string; gradient: string }> = {
  completed: { 
    bg: 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30', 
    text: 'text-emerald-700 dark:text-emerald-300', 
    ring: 'ring-emerald-300/40',
    gradient: 'from-emerald-500 to-teal-600'
  },
  'in-progress': { 
    bg: 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30', 
    text: 'text-blue-700 dark:text-blue-300', 
    ring: 'ring-blue-300/40',
    gradient: 'from-blue-500 to-indigo-600'
  },
  failed: { 
    bg: 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30', 
    text: 'text-red-700 dark:text-red-300', 
    ring: 'ring-red-300/40',
    gradient: 'from-red-500 to-rose-600'
  },
  cancelled: { 
    bg: 'bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-950/30 dark:to-pink-950/30', 
    text: 'text-red-700 dark:text-red-300', 
    ring: 'ring-red-300/40',
    gradient: 'from-red-500 to-pink-600'
  },
  draft: { 
    bg: 'bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/30 dark:to-slate-900/30', 
    text: 'text-gray-600 dark:text-gray-400', 
    ring: 'ring-gray-300/40',
    gradient: 'from-gray-400 to-slate-500'
  },
  expired: {
    bg: 'bg-gradient-to-br from-slate-50 to-gray-50 dark:from-slate-900/30 dark:to-gray-900/30',
    text: 'text-slate-700 dark:text-slate-300',
    ring: 'ring-slate-300/40',
    gradient: 'from-slate-500 to-gray-600'
  }
};

const daysBadge = (days?: number, expired?: boolean) => {
  if (days === undefined) return null;
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium border';
  if (expired) return;
  if (days === 0) return <span className={base + ' bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300'}>Today</span>;
  if (days === 1) return <span className={base + ' bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-300'}>1 day</span>;
  if (days <= 3) return <span className={base + ' bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-900/30 dark:border-yellow-700 dark:text-yellow-300'}>{days} days</span>;
  return <span className={base + ' bg-muted/40 border-border/60 text-muted-foreground'}>{days}d</span>;
};

const WorkflowGridView: React.FC<Props> = ({ items, loading, onView, onStart, onStop, onDelete, highlight }) => {
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [deletePending, setDeletePending] = useState<Record<string, boolean>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-40 rounded-xl border border-border bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <FileText className="h-10 w-10 opacity-40" />
        <span className="text-sm">No workflows found</span>
      </div>
    );
  }

  return (
    <>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map(wf => {
        const sc = statusColors[wf.status] || statusColors['draft'];
        const canDelete = ['draft','completed','cancelled'].includes(wf.status);
        return (
          <div
            key={wf.id}
            className={`group relative rounded-xl border border-[#ffb800]/40 bg-[#ffb800]/10 dark:bg-[#ffb800]/15 backdrop-blur-md hover:shadow-2xl transition-all duration-300 hover:scale-[1.02] hover:bg-[#ffb800]/20 dark:hover:bg-[#ffb800]/25 overflow-hidden ring-1 ring-transparent hover:${sc.ring} cursor-pointer`}
          >
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.06),transparent_70%)]" />
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-blue-500/0 group-hover:from-indigo-500/5 group-hover:to-blue-500/5 transition-all duration-300 pointer-events-none" />
            <div className="relative z-10 p-4 flex flex-col h-full">
              <div className="flex items-start justify-between mb-2">
                <div className="flex flex-col flex-1 min-w-0">
                  <h3 className="font-semibold text-sm leading-tight line-clamp-2">
                    {highlight ? highlight(wf.workflowName) : wf.workflowName}
                  </h3>
                  <span className="text-[11px] text-muted-foreground font-mono truncate flex items-center gap-1">
                    {wf.id}
                    <SigningModeBadge size="xs" hideLabelOnSmall isSequential={wf.isSequentialSigningEnabled} />
                  </span>
                </div>
                <div className="flex items-center gap-1 ml-2">
                  {canDelete && onDelete && (
                    <button
                      title="Delete workflow"
                      onClick={(e)=> { e.stopPropagation(); if (deletePending[wf.id]) return; setDeleteTargetId(wf.id); setShowDeleteConfirm(true); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded-md border border-red-300/60 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-300 disabled:opacity-50 order-1"
                      disabled={deletePending[wf.id]}
                    >
                      {deletePending[wf.id] ? <span className="h-3 w-3 border-2 border-red-500/60 border-t-transparent rounded-full animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-medium ${sc.bg} ${sc.text} border border-border/40 shadow-sm whitespace-nowrap order-2`}>{wf.status}</span>
                </div>
              </div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] text-muted-foreground line-clamp-1 flex-1 pr-2">
                  {highlight ? highlight(wf.templateName) : wf.templateName}
                </p>
                {/* Badge moved to workflow ID row */}
              </div>
              <div className="mt-auto flex flex-col gap-2">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <User className="h-3.5 w-3.5" /> {highlight ? highlight(wf.creator) : wf.creator}
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span><span className="opacity-60">Created:</span> {formatDateDDMMYYYY(wf.createdDate)}</span>
                  {daysBadge(wf.daysRemaining, wf.isExpired)}
                </div>
                {wf.validUntil && (
                  <div className="flex items-center gap-1 text-[9px] text-muted-foreground" title="Valid Until">
                    <span className="opacity-70">Due:</span>
                    <span className={wf.isExpired ? 'text-neutral-700 dark:text-neutral-400 font-medium' : ''}>{formatDateDDMMYYYY(wf.validUntil)}</span>
                  </div>
                )}
                <div className="mt-2 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    {wf.status === 'draft' && (
                      <Button
                        size="sm"
                        title="Start this draft workflow"
                        disabled={pending[wf.id]}
                        className="inline-flex items-center gap-1 h-8 text-[8px] font-medium rounded-md bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm hover:from-indigo-500 hover:to-blue-500 focus-visible:ring-2 focus-visible:ring-indigo-400/50 disabled:opacity-50"
                        onClick={(e) => { e.stopPropagation(); if (!onStart) return; setPending(p=>({...p,[wf.id]:true})); Promise.resolve(onStart(wf.id)).finally(()=> setPending(p=>({...p,[wf.id]:false}))); }}
                      >
                        {pending[wf.id] ? <span className="h-3 w-3 border-2 border-white/60 border-t-transparent rounded-full animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                        Start Workflow
                      </Button>
                    )}
                    {wf.status === 'in-progress' && (
                      <Button
                        size="sm"
                        title="Stop (cancel) this active workflow"
                        disabled={pending[wf.id]}
                        className="inline-flex items-center gap-1 h-8  text-[8px] font-medium rounded-md bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-sm hover:from-rose-500 hover:to-red-500 focus-visible:ring-2 focus-visible:ring-rose-400/50 disabled:opacity-50"
                        onClick={(e) => { e.stopPropagation(); if (!onStop) return; const confirmStop = window.confirm('Stop this workflow? Recipients will no longer be able to sign.'); if(!confirmStop) return; setPending(p=>({...p,[wf.id]:true})); Promise.resolve(onStop(wf.id)).finally(()=> setPending(p=>({...p,[wf.id]:false}))); }}
                      >
                        {pending[wf.id] ? <span className="h-3 w-3 border-2 border-white/60 border-t-transparent rounded-full animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                        Stop Workflow
                      </Button>
                    )}
                    <Button
                      size="sm"
                      title="View full workflow details"
                      className="inline-flex items-center gap-1 h-8 text-[8px] font-medium bg-muted/40 hover:bg-muted border border-border/60 rounded-md focus-visible:ring-2 focus-visible:ring-indigo-400/40"
                      onClick={(e) => { e.stopPropagation(); onView(wf.id); }}
                    >
                      <Eye className="h-3.5 w-3 text-indigo-600 dark:text-indigo-300" />
                      View Workflow
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
    {/* Delete Confirmation Modal (reused pattern from template deletion) */}
    {showDeleteConfirm && deleteTargetId && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/40"
          onClick={() => { if (!isDeleting) { setShowDeleteConfirm(false); setDeleteTargetId(null); } }}
        />
        <div
          role="dialog"
          aria-modal="true"
          className="relative w-full max-w-sm rounded-lg border border-border bg-background shadow-lg p-5 flex flex-col gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            <div className="flex-1">
              <h2 className="text-base font-semibold">Delete Workflow</h2>
              <p className="text-xs text-muted-foreground mt-1">
                This will permanently remove the workflow and its related records. This action cannot be undone.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isDeleting}
              onClick={() => { if (!isDeleting) { setShowDeleteConfirm(false); setDeleteTargetId(null); } }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                if (!deleteTargetId || !onDelete) return; setIsDeleting(true); setDeletePending(p=>({...p,[deleteTargetId]:true}));
                try {
                  await Promise.resolve(onDelete(deleteTargetId));
                } finally {
                  setDeletePending(p=>({...p,[deleteTargetId]:false}));
                  setIsDeleting(false);
                  setShowDeleteConfirm(false);
                  setDeleteTargetId(null);
                }
              }}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default WorkflowGridView;
