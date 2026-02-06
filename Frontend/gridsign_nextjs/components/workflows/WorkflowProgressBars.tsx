"use client";
import React from 'react';
import { cn } from '@/lib/utils';

interface WorkflowProgressBarsProps {
  signaturePct: number;
  envelopePct?: number | null;
  overallPct?: number | null;
  loading?: boolean;
}

const Bar: React.FC<{ pct: number; label: string; colorFrom: string; colorTo: string; title?: string; }> = ({ pct, label, colorFrom, colorTo, title }) => (
  <div className="group flex flex-col gap-1" title={title || label}> 
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden relative">
      <div className={cn("h-full transition-all", `bg-gradient-to-r from-${colorFrom} to-${colorTo}`)} style={{ width: `${pct}%` }} />
    </div>
    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
      <span className="font-medium">{label}</span>
      <span>{pct}%</span>
    </div>
  </div>
);

export const WorkflowProgressBars: React.FC<WorkflowProgressBarsProps> = ({ signaturePct, envelopePct, overallPct, loading }) => {
  return (
    <div className="space-y-2">
      <Bar pct={signaturePct} label="Signatures" colorFrom="green-500" colorTo="emerald-600" />
      {envelopePct != null && <Bar pct={Math.round(envelopePct)} label="Envelopes" colorFrom="blue-500" colorTo="indigo-600" />}
      {overallPct != null && <Bar pct={Math.round(overallPct)} label="Overall" colorFrom="teal-500" colorTo="cyan-600" />}
      {loading && <div className="text-[10px] animate-pulse text-muted-foreground">Updating progress…</div>}
    </div>
  );
};

export default WorkflowProgressBars;
