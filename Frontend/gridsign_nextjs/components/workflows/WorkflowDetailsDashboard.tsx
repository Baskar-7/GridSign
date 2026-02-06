"use client";
import React from 'react';
import { fromNow, formatDateTime } from '@/lib/utils';

interface TimestampChipProps {
  label: string;
  value?: string | null;
  emptyHint?: string;
}

const TimestampChip: React.FC<TimestampChipProps> = ({ label, value, emptyHint }) => {
  const isEmpty = !value;
  return (
    <div className="flex flex-col p-2 rounded-md border bg-background/70 min-w-[140px]">
      <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-[11px] font-medium truncate" title={value ? formatDateTime(value) : emptyHint || 'Not available'}>
        {value ? formatDateTime(value) : emptyHint || '—'}
      </span>
      <span className="text-[9px] text-muted-foreground">{!isEmpty ? fromNow(value) : ''}</span>
    </div>
  );
};

interface DashboardCompound extends React.FC<{ children?: React.ReactNode }> {
  TimestampChip: React.FC<TimestampChipProps>;
  StatusBadge: React.FC<StatusBadgeProps>;
}

const DashboardRoot: DashboardCompound = ({ children }) => (
  <div className="flex flex-col w-full space-y-4">{children}</div>
);

DashboardRoot.TimestampChip = TimestampChip;

// Reusable status badge for workflow status chips
interface StatusBadgeProps {
  status: string;
}

const statusBadgeClass = (s: string): { container: string; dot: string } => {
  switch (s.toLowerCase()) {
    case 'draft':
      return {
        container: 'bg-neutral-500/15 text-neutral-800 border-neutral-300 shadow-sm dark:bg-neutral-900/30 dark:text-neutral-300 dark:border-neutral-700/50',
        dot: 'bg-neutral-500'
      };
    case 'in progress':
    case 'in-progress':
      return {
        container: 'bg-blue-500/15 text-blue-800 border-blue-300 shadow-sm dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700/50',
        dot: 'bg-blue-500'
      };
    case 'completed':
      return {
        container: 'bg-green-500/15 text-green-800 border-green-300 shadow-sm dark:bg-green-900/30 dark:text-green-300 dark:border-green-700/50',
        dot: 'bg-green-500'
      };
    case 'failed':
      return {
        container: 'bg-red-500/15 text-red-800 border-red-300 shadow-sm dark:bg-red-900/30 dark:text-red-300 dark:border-red-700/50',
        dot: 'bg-red-500'
      };
    case 'cancelled':
      return {
        container: 'bg-rose-500/15 text-rose-800 border-rose-300 shadow-sm dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-700/50',
        dot: 'bg-rose-500'
      };
    case 'expired':
      return {
        container: 'bg-neutral-400/15 text-neutral-800 border-neutral-300 shadow-sm dark:bg-neutral-900/30 dark:text-neutral-300 dark:border-neutral-700/50',
        dot: 'bg-neutral-500'
      };
    default:
      return { container: 'bg-muted/60 text-muted-foreground border-border/50', dot: 'bg-muted-foreground' };
  }
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const cls = statusBadgeClass(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-semibold border ${cls.container}`}
      title={`Status: ${status}`}
    >
      <span className={`h-3 w-[3px] rounded-sm ${cls.dot}`} />
      <span className="leading-none uppercase tracking-wide">{status.replace('-', ' ')}</span>
    </span>
  );
};

DashboardRoot.StatusBadge = StatusBadge;

export const WorkflowDetailsDashboard = DashboardRoot;
export default DashboardRoot;
