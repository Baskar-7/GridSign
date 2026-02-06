"use client";
import React from 'react';

export interface StatusMetrics {
  total: number;
  completed: number;
  inProgress: number;
  failed: number;
  cancelled: number;
  draft: number;
  avgTurnaroundHours: number;
  completionRate: number; // 0-1
  failureRate: number; // 0-1
}

interface Props {
  metrics: StatusMetrics;
}

const MetricCard: React.FC<{ label: string; value: string; sub?: string; accent?: string }> = ({ label, value, sub, accent }) => (
  <div className="rounded-lg border bg-card/80 backdrop-blur px-4 py-3 flex flex-col gap-1 shadow-sm">
    <span className="text-xs font-medium text-muted-foreground">{label}</span>
    <span className={`text-2xl font-semibold tracking-tight ${accent || ''}`}>{value}</span>
    {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
  </div>
);

const StatusOverview: React.FC<Props> = ({ metrics }) => {
  const { total, completed, inProgress, failed, cancelled, draft, avgTurnaroundHours, completionRate, failureRate } = metrics;
  const fmtPct = (n: number) => (isNaN(n) ? '0%' : (n * 100).toFixed(1) + '%');
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
      <MetricCard label="Total" value={String(total)} />
      <MetricCard label="Completed" value={String(completed)} sub={fmtPct(completionRate)} accent="text-green-600" />
      <MetricCard label="In Progress" value={String(inProgress)} accent="text-blue-600" />
      <MetricCard label="Failures" value={String(failed + cancelled)} sub={fmtPct(failureRate)} accent="text-red-600" />
      <MetricCard label="Drafts" value={String(draft)} accent="text-gray-600" />
      <MetricCard label="Avg Turnaround" value={`${avgTurnaroundHours.toFixed(1)}h`} sub="created→updated" accent="text-purple-600" />
    </div>
  );
};

export default StatusOverview;
