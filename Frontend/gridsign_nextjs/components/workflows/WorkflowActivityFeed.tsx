"use client";
import React, { useMemo } from 'react';
import { formatDateDDMMYYYY } from '@/lib/utils';
import { Eye, Clock, User, FileText, Play, Square, Trash2 } from 'lucide-react';
import SigningModeBadge from './SigningModeBadge';
import { Button } from '@/components/ui/button';

export interface ActivityWorkflowRecord {
  id: string;
  workflowName: string;
  templateName: string;
  creator: string;
  status: 'completed' | 'in-progress' | 'expired' | 'cancelled' | 'draft' | 'failed';
  createdDate: string;
  updatedDate: string;
  validUntil?: string;
  daysRemaining?: number;
  isExpired?: boolean;
  isSequentialSigningEnabled?: boolean;
}

interface Props {
  items: ActivityWorkflowRecord[];
  loading?: boolean;
  onView: (id: string) => void;
  onStart?: (id: string) => void; // start draft
  onStop?: (id: string) => void;  // stop in-progress
  highlight?: (text: string) => React.ReactNode;
  onDelete?: (id: string) => void; // request deletion
}

const statusAccent: Record<ActivityWorkflowRecord['status'], string> = {
  completed: 'bg-green-500',
  'in-progress': 'bg-blue-500',
  expired: 'bg-neutral-500',
  cancelled: 'bg-red-400',
  draft: 'bg-gray-400',
  failed: 'bg-red-500'
};

const relativeTime = (iso: string) => {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = now - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const week = Math.floor(day / 7);
  if (week < 4) return `${week}w ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month}mo ago`;
  const year = Math.floor(day / 365);
  return `${year}y ago`;
};

const WorkflowActivityFeed: React.FC<Props> = ({ items, loading, highlight, onView, onStart, onStop, onDelete }) => {
  const events = useMemo(() => {
    const all: Array<{ id: string; type: 'created' | 'updated'; when: string; wf: ActivityWorkflowRecord }> = [];
    for (const wf of items) {
      all.push({ id: `${wf.id}-created`, type: 'created', when: wf.createdDate, wf });
      if (wf.updatedDate !== wf.createdDate) {
        all.push({ id: `${wf.id}-updated`, type: 'updated', when: wf.updatedDate, wf });
      }
    }
    all.sort((a,b) => new Date(b.when).getTime() - new Date(a.when).getTime());
    return all;
  }, [items]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const ev of events) {
      // Unified date group header
      const key = formatDateDDMMYYYY(ev.when);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return Array.from(map.entries());
  }, [events]);

  if (loading) {
    return (
      <div className="space-y-6">
        {[...Array(3)].map((_,i) => (
          <div key={i} className="space-y-3">
            <div className="h-4 w-40 bg-muted rounded" />
            {[...Array(3)].map((__,j) => <div key={j} className="h-20 rounded-md border border-border bg-muted/40 animate-pulse" />)}
          </div>
        ))}
      </div>
    );
  }

  if (!events.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
        <FileText className="h-10 w-10 opacity-40" />
        <span className="text-sm">No workflow activity found</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {grouped.map(([dateLabel, evs]) => (
        <div key={dateLabel} className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight">{dateLabel}</h3>
            <span className="text-[10px] text-muted-foreground">{evs.length} event{evs.length === 1 ? '' : 's'}</span>
          </div>
          <div className="space-y-3">
            {evs.map(ev => {
              const wf = ev.wf;
              const accent = statusAccent[wf.status];
              return (
                <div
                  key={ev.id}
                  className="group relative rounded-lg border border-border bg-background/70 backdrop-blur px-4 py-3 flex flex-col gap-2 shadow-sm hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-white ${accent}`}>{ev.type === 'created' ? 'Created' : 'Updated'}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border border-border/50`}>{wf.status}</span>
                      </div>
                      <h4 className="text-sm font-semibold leading-tight flex items-center gap-2">{highlight ? highlight(wf.workflowName) : wf.workflowName}<SigningModeBadge size="xs" isSequential={wf.isSequentialSigningEnabled} /></h4>
                      <span className="text-[11px] font-mono text-muted-foreground">{wf.id}</span>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-right text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {relativeTime(ev.when)}</span>
                      <span className="flex items-center gap-1"><User className="h-3 w-3" /> {highlight ? highlight(wf.creator) : wf.creator}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <span className="truncate max-w-[160px]">{highlight ? highlight(wf.templateName) : wf.templateName}</span>
                      {wf.daysRemaining !== undefined && (
                        wf.isExpired ? (
                          <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 border border-neutral-200 text-[9px] font-medium">Expired</span>
                        ) : wf.daysRemaining === 0 ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-medium">Today</span>
                        ) : wf.daysRemaining === 1 ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-medium">1d</span>
                        ) : wf.daysRemaining <= 3 ? (
                          <span className="px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 border border-yellow-200 text-[9px] font-medium">{wf.daysRemaining}d</span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-muted/40 text-muted-foreground border border-border/50 text-[9px] font-medium">{wf.daysRemaining}d</span>
                        )
                      )}
                    </span>
                    <span className="flex gap-2">
                      {wf.validUntil && <span className={"hidden md:inline " + (wf.isExpired ? 'text-neutral-700 font-medium' : 'opacity-70')} title="Valid Until"><span className="opacity-60">Due:</span> {formatDateDDMMYYYY(wf.validUntil)}</span>}
                      {wf.status === 'draft' && (
                        <Button
                          size="sm"
                          className="h-6 px-2 text-[10px] gap-1 bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-500 hover:to-blue-500 focus-visible:ring-2 focus-visible:ring-indigo-400/50"
                          title="Start workflow"
                          aria-label="Start workflow"
                          disabled={!onStart}
                          onClick={() => onStart && onStart(wf.id)}
                        >
                          <Play className="h-3 w-3" /> Start
                        </Button>
                      )}
                      {wf.status === 'in-progress' && (
                        <Button
                          size="sm"
                          className="h-6 px-2 text-[10px] gap-1 bg-gradient-to-r from-rose-600 to-red-600 text-white hover:from-rose-500 hover:to-red-500 focus-visible:ring-2 focus-visible:ring-rose-400/50"
                          title="Stop workflow"
                          aria-label="Stop workflow"
                          disabled={!onStop}
                          onClick={() => onStop && onStop(wf.id)}
                        >
                          <Square className="h-3 w-3" /> Stop
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[10px] gap-1 hover:bg-primary/10 hover:text-primary"
                        onClick={() => onView(wf.id)}
                        title="View workflow"
                        aria-label="View workflow"
                      >
                        <Eye className="h-3 w-3" /> View
                      </Button>
                      {onDelete && ['draft','completed','cancelled'].includes(wf.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px] gap-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                          onClick={() => onDelete(wf.id)}
                          title="Delete workflow"
                          aria-label="Delete workflow"
                        >
                          <Trash2 className="h-3 w-3" /> Del
                        </Button>
                      )}
                      {/* Removed 'Use' per requirement */}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

export default WorkflowActivityFeed;
