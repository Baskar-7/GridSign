"use client";

import React, { useMemo, useState, useEffect } from "react";
import {
  FileText,
  CheckCircle,
  TrendingUp,
  Users,
} from "lucide-react";
import { Separator } from "./ui/separator";
import { useSidebarReport } from '@/hooks/useSidebarReport';
import { ExternalLink, Bell, Clock } from 'lucide-react';

// Right sidebar now driven by aggregated API instead of hard-coded mock data

const Rightsidebar = () => {
    const sidebarQuery = useSidebarReport();
    const quickStats = sidebarQuery.data?.data?.quickStats;
    const completion = sidebarQuery.data?.data?.completionInsights;
    // Unwrap potential $values from backend serializer for expiringWorkflows
    const unwrapList = (v: any): any[] => {
      if (!v) return [];
      if (Array.isArray(v)) return v;
      if (typeof v === 'object' && Array.isArray(v.$values)) return v.$values;
      return [];
    };
    const expiringRaw = sidebarQuery.data?.data?.expiringWorkflows;
    const expiring = unwrapList(expiringRaw);
    // Hydration mismatch guard: only show dynamic loading state after mount
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    // Stable SSR placeholder: avoid hydration mismatch by deferring dynamic values until mounted
    const stats = useMemo(() => {
      if (!mounted) {
        // Show skeleton-like placeholders with '--' so server/client match
        return [
          { label: 'Documents', value: '--', icon: FileText, color: 'text-blue-500' },
          { label: 'Pending', value: '--', icon: Clock, color: 'text-yellow-500' },
          { label: 'Completed', value: '--', icon: CheckCircle, color: 'text-green-600' }
        ];
      }
      if (quickStats) {
        return [
          { label: 'Documents', value: String(quickStats.totalDocuments), icon: FileText, color: 'text-blue-500' },
          { label: 'Pending', value: String(quickStats.pending), icon: Clock, color: 'text-yellow-500' },
          { label: 'Completed', value: String(quickStats.completed), icon: CheckCircle, color: 'text-green-600' }
        ];
      }
      return [];
    }, [quickStats, mounted]);

    // Stable text for completion rate & trend to avoid differing server/client first paint
    const completionDisplay = mounted
      ? (completion ? `${completion.completionRatePct.toFixed(1)}%` : sidebarQuery.isLoading ? '…' : '0%')
      : '…';
    const trendDisplay = mounted
      ? (completion ? `${completion.trendDeltaPct >= 0 ? '+' : ''}${completion.trendDeltaPct.toFixed(1)}% vs prior` : sidebarQuery.isLoading ? 'Calculating…' : 'No data')
      : 'Calculating…';

    return (
        <aside className="hidden xl:block fixed right-0 top-16 bottom-0 w-80 border-l border-border bg-card overflow-y-auto z-30 shadow-sm">
            <div className="p-6 space-y-6">
                {/* Quick Stats */}
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Quick Stats
                    </h3>
                    <div className="space-y-3">
                        {stats.map((stat) => (
                            <div
                                key={stat.label}
                                className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border hover:border-primary/50 hover:shadow-sm transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`p-2 rounded-md bg-primary/10 ${stat.color}`}
                                    >
                                        <stat.icon className="h-4 w-4" />
                                    </div>
                                    <span className="text-sm font-medium text-foreground">
                                        {stat.label}
                                    </span>
                                </div>
                                <span className="text-lg font-bold text-foreground">
                                    {stat.value}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <Separator />

                {/* Upcoming Expiring Workflows */}
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Expiring Soon</h3>
                    <div className="space-y-3">
                        {mounted && sidebarQuery.isLoading && (
                          <div className="text-xs text-muted-foreground">Loading expiring workflows…</div>
                        )}
                        {mounted && !sidebarQuery.isLoading && expiring.length === 0 && (
                          <div className="text-xs text-muted-foreground">No workflows expiring soon</div>
                        )}
                        {!mounted && (
                          <div className="text-xs text-muted-foreground">Loading…</div>
                        )}
                        {expiring.map((w: any) => {
                          // Map all severities into amber/yellow palette except critical (red)
                          const severity = w.daysRemaining <= 2 ? 'critical' : w.daysRemaining <= 5 ? 'near' : 'upcoming';
                          const palette = {
                            critical: { border: 'border-red-500', bg: 'bg-red-50 dark:bg-red-950', accent: 'bg-red-500', text: 'text-red-600 dark:text-red-400', badge: 'bg-red-500/10 text-red-600 dark:text-red-300 border-red-500/30' },
                            near: { border: 'border-amber-500', bg: 'bg-amber-50 dark:bg-amber-950', accent: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-300 border-amber-500/30' },
                            upcoming: { border: 'border-amber-400', bg: 'bg-amber-50 dark:bg-amber-950', accent: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-300', badge: 'bg-amber-400/10 text-amber-600 dark:text-amber-300 border-amber-400/30' }
                          }[severity];
                          const pct = Math.max(0, Math.min(100, (1 - (w.daysRemaining / 14)) * 100));
                          return (
                            <div key={w.workflowId} className={`group relative rounded-md border p-3 transition-colors ${palette.border} ${palette.bg}`}> 
                              {/* Accent left bar */}
                              <div className={`absolute left-0 top-0 bottom-0 w-1 ${palette.accent} rounded-l-md`} />
                              {/* Top progress strip */}
                              <div className="absolute left-1 top-0 right-0 h-0.5 bg-border overflow-hidden rounded-tr-md">
                                <div className={`${palette.accent} h-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                              </div>
                              {/* Action icons (remind left, open right) */}
                              <div className="absolute top-1 right-1 flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  aria-label={`Send reminder for workflow ${w.workflowName}`}
                                  title="Send reminder"
                                  disabled={w.daysRemaining <= 0}
                                  onClick={async () => {
                                    try {
                                      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
                                      await fetch('/api/workflow/remind-all', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                                        body: JSON.stringify({ workflowId: w.workflowId })
                                      });
                                    } catch {/* ignore */}
                                  }}
                                  className="h-6 w-6 inline-flex items-center justify-center rounded-sm bg-background/40 hover:bg-primary/10 hover:text-primary transition-colors disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-primary/50"
                                >
                                  <Bell className="h-3.5 w-3.5" />
                                </button>
                                <a
                                  href={`/workflow/${w.workflowId}`}
                                  aria-label={`Open workflow ${w.workflowName}`}
                                  title="Open"
                                  className="h-6 w-6 inline-flex items-center justify-center rounded-sm bg-background/40 hover:bg-primary/10 hover:text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </div>
                              <div className="flex items-start gap-3">
                                <div className="flex flex-col items-center mt-1 min-w-[42px]" aria-label={`Workflow expires in ${w.daysRemaining} days`}>
                                  <Clock className={`h-4 w-4 ${palette.text.replace('text-','')}`} />
                                  <span className={`mt-1 text-lg font-bold tabular-nums leading-none ${palette.text}`}>{w.daysRemaining}</span>
                                  <span className="text-[10px] font-medium text-muted-foreground/70 mt-0.5">days</span>
                                </div>
                                <div className="flex-1 min-w-0 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium truncate" title={w.workflowName}>{w.workflowName}</p>
                                    {w.templateName && (
                                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border text-[10px] font-medium ${palette.badge}`} title={`Template: ${w.templateName}`}>
                                        <FileText className="h-3 w-3" />
                                        <span className="truncate max-w-[90px]">{w.templateName}</span>
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                    <span title={w.validUntil}>{new Date(w.validUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                    <span className={`uppercase tracking-wide text-[10px] font-semibold ${palette.text}`}>{severity}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                </div>

                <Separator />

                {/* Completion Insights */}
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Completion Insights</h3>
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-foreground">Completion Rate</span>
                          <TrendingUp className="h-4 w-4 text-green-600" />
                        </div>
                        <div className="text-2xl font-bold text-foreground">
                          {completionDisplay}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {trendDisplay}
                        </div>
                      </div>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default Rightsidebar;
