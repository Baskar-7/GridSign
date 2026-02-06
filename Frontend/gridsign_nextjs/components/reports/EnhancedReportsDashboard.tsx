"use client";
import React, { useMemo, useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button"; 
import {
  TrendingUp,
  FileText, 
  CheckCircle,
  Clock,
  Download, 
  BarChart3,
  Activity, 
} from "lucide-react";
import ReportInfoIcon from './ReportInfoIcon';
import { REPORT_HELP_TEXTS } from '@/lib/reportHelpTexts';
// Using relative path for reliability while TS path alias issue is resolved
import { logTooltipEvent } from '../../lib/reportAnalytics';
import HelpExplanationsToggle from './HelpExplanationsToggle';
import { triggerExtendedReportDownload } from '@/lib/reportExport';
import SparkBar from './charts/SparkBar'; 
import LegendToggle from './charts/LegendToggle';
import AnimationReplayButton from './AnimationReplayButton';
import { AdvancedArea, AdvancedBar, AdvancedDonut, CHART_COLORS } from './AdvancedCharts'; 
import { useExtendedReports } from '@/hooks/useExtendedReports';
import type { ReportExtendedDto } from '@/types/report';
import { toast } from 'sonner';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string }>;
}

const CountUp: React.FC<{ end: number; duration?: number; prefix?: string; suffix?: string }> = ({ end, duration = 0.8, prefix='', suffix='' }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let frame: number; const start = performance.now(); const d = duration * 1000; const animate = (t: number) => {
      const p = Math.min(1, (t - start) / d); const eased = 1 - Math.pow(1 - p, 3); setDisplay(Math.round(eased * end)); if (p < 1) frame = requestAnimationFrame(animate);
    }; frame = requestAnimationFrame(animate); return () => cancelAnimationFrame(frame);
  }, [end, duration]);
  return <>{prefix}{display.toLocaleString()}{suffix}</>;
};

const MetricCard: React.FC<MetricCardProps & { spark?: number[] }> = ({ title, value, subtitle, icon: Icon, spark }) => {
  const numeric = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.]/g,''));
  const isNumeric = !Number.isNaN(numeric);
  return (
    <Card className="border border-border relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-2xl font-bold leading-none tracking-tight">
          {isNumeric ? <CountUp end={numeric} /> : value}
        </div>
        {spark && <SparkBar values={spark} height={34} />}
        {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
      </CardContent>
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
    </Card>
  );
};

// Replaced simple handcrafted charts with AdvancedCharts (Recharts-based)

const EnhancedReportsDashboard: React.FC = () => {
  const [dateRange, setDateRange] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('reports.dateRange');
      if (stored) return stored;
    }
    return '7d';
  });
  const [animSeed, setAnimSeed] = useState(0);
  // Persist dateRange
  useEffect(() => {
    try { localStorage.setItem('reports.dateRange', dateRange); } catch { /* ignore */ }
    // Update global gridsignPrefs with current dateRange (retain existing status filters if present)
    try {
      const raw = localStorage.getItem('gridsignPrefs');
      const prefs = raw ? JSON.parse(raw) : {};
      const existingFilters: string[] = Array.isArray(prefs.reportsFilters) ? prefs.reportsFilters.filter((f: string) => !f.startsWith('dateRange:')) : [];
      prefs.reportsFilters = [`dateRange:${dateRange}`, ...existingFilters];
      prefs.updatedAt = new Date().toISOString();
      localStorage.setItem('gridsignPrefs', JSON.stringify(prefs));
      window.dispatchEvent(new StorageEvent('storage', { key: 'gridsignPrefs', newValue: JSON.stringify(prefs) }));
    } catch {/* ignore */}
  }, [dateRange]);

  // Intersection Observer for fade/slide sections
  const appearRefs = useRef<HTMLElement[]>([]);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});
  useEffect(() => {
    const els = appearRefs.current.filter(Boolean);
    if (!els.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const idx = Number((entry.target as HTMLElement).dataset.animIndex);
            setRevealed(r => r[idx] ? r : { ...r, [idx]: true });
        }
      });
    }, { threshold: 0.15 });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [animSeed]);

  const setAppearRef = (el: HTMLElement | null) => {
    if (el && !appearRefs.current.includes(el)) {
      appearRefs.current.push(el);
    }
  };

  const replayAnimations = () => setAnimSeed(s => s + 1);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Extended report fetch (primary)
  const extendedQuery = useExtendedReports(dateRange);
  const extendedRaw = extendedQuery.data?.data as any;
  // Helper to unwrap potential { $values: [...] } from backend serialized collections (e.g. EF Core)
  const unwrapList = (v: any): any[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v;
    if (typeof v === 'object' && Array.isArray(v.$values)) return v.$values;
    return [];
  };
  // Normalize casing differences from backend (PascalCase vs camelCase)
  const extended: ReportExtendedDto | undefined = extendedRaw ? {
    ...extendedRaw,
    weeklyActivity: unwrapList(extendedRaw.weeklyActivity || extendedRaw.WeeklyActivity),
    templateUsage: unwrapList(extendedRaw.templateUsage || extendedRaw.TemplateUsage),
    metricsHistory: unwrapList(extendedRaw.metricsHistory || extendedRaw.MetricsHistory),
    upcomingExpirations: unwrapList(extendedRaw.upcomingExpirations || extendedRaw.UpcomingExpirations),
    rangeStart: extendedRaw.rangeStart || extendedRaw.RangeStart || '',
    rangeEnd: extendedRaw.rangeEnd || extendedRaw.RangeEnd || '',
    generatedAt: extendedRaw.generatedAt || extendedRaw.GeneratedAt || ''
  } : undefined;
  const report = extended?.summary; // fallback to summary portion
  const loadingReport = extendedQuery.isLoading;
  useEffect(() => {
    if (extendedQuery.error) {
      toast.error(extendedQuery.error.message || 'Failed to load extended reports');
    }
  }, [extendedQuery.error]);

  // Derive dynamic metrics (fallback to zero while loading)
  const totalWorkflows = report?.total ?? 0;
  const completedCount = report?.completed ?? 0;
  const inProgressCount = report?.inProgress ?? 0;
  const draftCount = report?.draft ?? 0;
  const expiredCount = report?.expired ?? 0;
  const cancelledCount = report?.cancelled ?? 0;
  const failedCount = report?.failed ?? 0;

  // Compute completion rate & average completion time (prefer backend averages block if provided)
  const completionRatePct = extended?.averages?.completionRatePct ?? (totalWorkflows ? Math.round((completedCount / totalWorkflows) * 100) : 0);
  const avgCompletionTimeDays = extended?.averages?.avgCompletionTimeDays ?? 0;

  // Dynamic workflow activity (weeklyActivity) or empty fallback
  const workflowTrend = useMemo(() => {
    const arr = Array.isArray(extended?.weeklyActivity) ? extended!.weeklyActivity : [];
    return arr.map((p: any) => ({ label: p.dayLabel, value: p.count }));
  }, [extended?.weeklyActivity]);

  const templateUsage = useMemo(() => {
    const arr = Array.isArray(extended?.templateUsage) ? extended!.templateUsage : [];
    return arr.map((t: any) => {
      const templateName = t.templateName || t.TemplateName || (t.templateId || t.TemplateId ? '(Unknown Template)' : '(No Template)');
      const total = t.total ?? t.Total ?? 0;
      const completed = t.completed ?? t.Completed ?? 0;
      const avgCompletionDays = t.avgCompletionDays ?? t.AvgCompletionDays ?? 0;
      const successRatePct = t.successRatePct ?? t.SuccessRatePct ?? 0;
      if (!t.templateName && t.TemplateName) {
        // eslint-disable-next-line no-console
        console.debug('[ReportsDashboard] Using PascalCase TemplateName fallback');
      }
      if (!templateName) {
        // eslint-disable-next-line no-console
        console.warn('[ReportsDashboard] Missing template name for usage row', t);
      }
      return { label: templateName, value: total, completed, avgDays: avgCompletionDays, successRatePct };
    });
  }, [extended?.templateUsage]);

  const statusData = useMemo(
    () => [
      { label: "Completed", value: completedCount, color: '#10b981' }, // custom green
      { label: "In Progress", value: inProgressCount, color: '#2563eb' }, // custom blue
      { label: "Draft", value: draftCount, color: CHART_COLORS[2] },
      { label: "Expired", value: expiredCount, color: CHART_COLORS[3] },
      { label: "Cancelled", value: cancelledCount, color: '#fda4af' }, // custom pale red
      { label: "Failed", value: failedCount, color: CHART_COLORS[5] },
    ].filter(s => s.value > 0),
    [completedCount,inProgressCount,draftCount,expiredCount,cancelledCount,failedCount]
  );

  // Recent activity & top users removed per request

  const exportReport = () => {
    if (!extended) {
      toast.info('Report not ready yet');
      return;
    }
    try {
      triggerExtendedReportDownload(extended);
      toast.success('CSV export started');
    } catch (e:any) {
      toast.error(e?.message || 'Export failed');
    }
  };

  // Legend toggle state for statusData
  const [legendActive, setLegendActive] = useState<Record<string, boolean>>(() => {
    const base = Object.fromEntries(statusData.map(s => [s.label, true]));
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('reports.legendActive');
        if (raw) {
          const saved = JSON.parse(raw);
          // merge with current keys
          return { ...base, ...saved };
        }
      } catch {/* ignore */}
    }
    return base;
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('reports.legendActive', JSON.stringify(legendActive)); } catch {/* ignore */}
    }
    // Sync active statuses into global prefs alongside dateRange
    try {
      const raw = localStorage.getItem('gridsignPrefs');
      const prefs = raw ? JSON.parse(raw) : {};
      const activeStatuses = Object.entries(legendActive).filter(([_, v]) => v).map(([label]) => label);
      // Find existing dateRange entry or create one
      const existingDate = Array.isArray(prefs.reportsFilters) ? prefs.reportsFilters.find((f: string) => f.startsWith('dateRange:')) : null;
      const currentDateEntry = existingDate || `dateRange:${dateRange}`;
      prefs.reportsFilters = [currentDateEntry, ...activeStatuses];
      prefs.updatedAt = new Date().toISOString();
      localStorage.setItem('gridsignPrefs', JSON.stringify(prefs));
      window.dispatchEvent(new StorageEvent('storage', { key: 'gridsignPrefs', newValue: JSON.stringify(prefs) }));
    } catch {/* ignore */}
  }, [legendActive]);
  const toggleLegend = (label: string) => setLegendActive(prev => ({ ...prev, [label]: !prev[label] }));
  const filteredStatus = statusData.filter(s => legendActive[s.label]);

  // Hydrate from global gridsignPrefs on initial mount (overrides localStorage specific keys)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('gridsignPrefs');
      if (!raw) return;
      const prefs = JSON.parse(raw);
      if (Array.isArray(prefs.reportsFilters) && prefs.reportsFilters.length) {
        const dateEntry = prefs.reportsFilters.find((f: string) => f.startsWith('dateRange:'));
        if (dateEntry) {
          const dr = dateEntry.split(':')[1];
          if (['7d','30d','90d','1y'].includes(dr) && dr !== dateRange) setDateRange(dr);
        }
        const statuses = prefs.reportsFilters.filter((f: string) => !f.startsWith('dateRange:'));
        if (statuses.length) {
          setLegendActive(prev => {
            const next = { ...prev };
            Object.keys(next).forEach(k => { next[k] = statuses.includes(k); });
            return next;
          });
        }
      }
    } catch {/* ignore */}
  }, []);

  // Metrics history (for spark lines & trend panels)
  const historyPoints = useMemo(() => {
    if (!extended?.metricsHistory?.length) return [] as any[];
    // ensure chronological order
    return [...extended.metricsHistory].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [extended?.metricsHistory]);

  // Spark series derived from metrics history (fallback to undefined to hide spark while loading)
  const sparkTotal = historyPoints.length ? historyPoints.map(p => p.total) : undefined;
  const sparkCompleted = historyPoints.length ? historyPoints.map(p => p.completed) : undefined;
  const sparkInProgress = historyPoints.length ? historyPoints.map(p => p.inProgress) : undefined;
  const sparkDraft = historyPoints.length ? historyPoints.map(p => p.draft) : undefined;

  // Expiring workflows (reuse extended report's upcomingExpirations to avoid extra API call)
  const upcomingExpirations = useMemo(() => {
    const arr = Array.isArray(extended?.upcomingExpirations) ? extended!.upcomingExpirations : [];
    return arr.slice().sort((a: any,b: any) => (a.daysRemaining ?? a.DaysRemaining) - (b.daysRemaining ?? b.DaysRemaining)).slice(0, 8);
  }, [extended?.upcomingExpirations]);

  // Help mode (inline descriptions)
  const [helpMode, setHelpMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('reports.helpMode');
      return stored === 'true';
    }
    return false;
  });
  useEffect(() => {
    try { localStorage.setItem('reports.helpMode', String(helpMode)); } catch {/* ignore */}
  }, [helpMode]);
  const toggleHelpMode = () => setHelpMode(h => !h);

  return (
    <div className="w-full mx-auto max-w-[1600px] space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track performance and insights across your workflows
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => { setDateRange(e.target.value); setAnimSeed(s => s + 1); }}
            className="px-3 py-2 border border-border rounded-md bg-background text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => exportReport()} className="gap-2">
            <Download className="h-4 w-4" />
            Export
          </Button>
          <HelpExplanationsToggle active={helpMode} onToggle={toggleHelpMode} />
            <AnimationReplayButton onReplay={replayAnimations} />
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Workflows"
          value={loadingReport ? 0 : totalWorkflows}
          subtitle={loadingReport ? 'Loading…' : `Completion ${completionRatePct}%`}
          icon={FileText}
          spark={sparkTotal}
        />
        <MetricCard
          title="Completed"
          value={loadingReport ? 0 : completedCount}
          subtitle={loadingReport ? 'Loading…' : `${completionRatePct}% of total`}
          icon={CheckCircle}
          spark={sparkCompleted}
        />
        <MetricCard
          title="In Progress"
          value={loadingReport ? 0 : inProgressCount}
          subtitle={loadingReport ? 'Loading…' : `${inProgressCount} active right now`}
          icon={Activity}
          spark={sparkInProgress}
        />
        <MetricCard
          title="Draft"
          value={loadingReport ? 0 : draftCount}
          subtitle={loadingReport ? 'Loading…' : `${draftCount} awaiting start`}
          icon={Clock}
          spark={sparkDraft}
        />
      </div>

      {/* Main Charts Row */}
  <div className="grid gap-6 lg:grid-cols-2" ref={setAppearRef as any} data-anim-index={0}>
        {/* Workflow Trend */}
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" /> Workflow Activity
              <ReportInfoIcon
                content={REPORT_HELP_TEXTS.workflowActivity}
                id="help-workflowActivity"
                forceInline={helpMode}
                onOpenChange={(o) => o && logTooltipEvent('workflowActivity')}
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {workflowTrend.length > 0 ? (
              <AdvancedArea
                data={workflowTrend.map(d => ({ name: d.label, value: d.value }))}
                title="Weekly workflow activity"
                animateKey={`area-${animSeed}`}
                reducedMotion={reducedMotion}
              />
            ) : <div className="text-xs text-muted-foreground">No activity data</div>}
          </CardContent>
        </Card>

        {/* Template Usage */}
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" /> Template Usage
              <ReportInfoIcon
                content={REPORT_HELP_TEXTS.templateUsage}
                id="help-templateUsage"
                forceInline={helpMode}
                onOpenChange={(o) => o && logTooltipEvent('templateUsage')}
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {templateUsage.length > 0 ? (
              <AdvancedBar
                data={templateUsage.map(d => ({ name: d.label, count: d.value }))}
                title="Template usage distribution"
                bars={[{ dataKey: 'count', name: 'Usage' }]}
                categorical
                animateKey={`tmpl-${animSeed}`}
                reducedMotion={reducedMotion}
                labelTruncateLength={12}
                labelEllipsis={'....'}
                tooltipGray
              />
            ) : <div className="text-xs text-muted-foreground">No template usage data</div>}
          </CardContent>
        </Card>
      </div>

      {/* Status Distribution */}
      <Card className="border border-border">
        <CardHeader className="flex items-start justify-between gap-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" /> Status Distribution
            <ReportInfoIcon
              content={REPORT_HELP_TEXTS.statusDistribution}
              id="help-statusDistribution"
              forceInline={helpMode}
              onOpenChange={(o) => o && logTooltipEvent('statusDistribution')}
            />
          </CardTitle>
          <LegendToggle
            items={statusData.map(s => ({ label: s.label, color: s.color, active: legendActive[s.label] }))}
            onToggle={toggleLegend}
          />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <AdvancedBar
                data={filteredStatus.map(fs => ({ name: fs.label, value: fs.value, color: fs.color }))}
                title={loadingReport ? 'Loading status distribution' : 'Workflow status distribution'}
                bars={[{ dataKey: 'value', name: 'Count' }]}
                categorical
                animateKey={`status-${animSeed}-${filteredStatus.length}`}
                reducedMotion={reducedMotion}
                tooltipGray
                labelTruncateLength={10}
                labelEllipsis={'....'}
              />
            </div>
            <div className="flex items-center justify-center">
              <AdvancedDonut
                data={filteredStatus.map(s => ({ label: s.label, value: s.value, color: s.color }))}
                title={loadingReport ? 'Loading…' : 'Status Share'}
                animateKey={`donut-${animSeed}-${filteredStatus.length}`}
                reducedMotion={reducedMotion}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* New Right-Side Panels */}
      <div className="grid gap-6 lg:grid-cols-2" ref={setAppearRef as any} data-anim-index={1}>
        {/* Upcoming Expirations */}
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" /> Upcoming Expirations
              <ReportInfoIcon
                content={REPORT_HELP_TEXTS.upcomingExpirations}
                id="help-upcomingExpirations"
                forceInline={helpMode}
                onOpenChange={(o) => o && logTooltipEvent('upcomingExpirations')}
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingExpirations.length ? (
              <ul className="space-y-2">
                {upcomingExpirations.map(u => (
                  <li key={u.workflowId} className="flex items-center justify-between text-xs border-b last:border-b-0 py-1">
                    <span className="truncate max-w-[60%]" title={u.workflowName}>{u.workflowName}</span>
                    <span className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium border ${u.daysRemaining <= 2 ? 'bg-red-50 border-red-300 text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300' : u.daysRemaining <= 5 ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300' : 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300'}`}>{u.daysRemaining}d</span>
                      <span className="text-muted-foreground" title={u.validUntil}>{new Date(u.validUntil).toLocaleDateString()}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : <div className="text-xs text-muted-foreground">{loadingReport ? 'Loading expiring workflows…' : 'No upcoming expirations in range'}</div>}
          </CardContent>
        </Card>
        {/* Daily Status Trend */}
        <Card className="border border-border">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" /> Daily Status Trend
              <ReportInfoIcon
                content={REPORT_HELP_TEXTS.dailyStatusTrend}
                id="help-dailyStatusTrend"
                forceInline={helpMode}
                onOpenChange={(o) => o && logTooltipEvent('dailyStatusTrend')}
              />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {historyPoints.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="px-2 py-1 text-left font-medium">Date</th>
                      <th className="px-2 py-1 text-right font-medium">Total</th>
                      <th className="px-2 py-1 text-right font-medium">Completed</th>
                      <th className="px-2 py-1 text-right font-medium">In Prog.</th>
                      <th className="px-2 py-1 text-right font-medium">Draft</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {historyPoints.slice(-14).map(h => {
                      const d = new Date(h.date); // assume date ISO
                      const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                      return (
                        <tr key={h.date} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                          <td className="px-2 py-1 font-medium">{label}</td>
                          <td className="px-2 py-1 text-right">{h.total}</td>
                          <td className="px-2 py-1 text-right text-emerald-600 dark:text-emerald-400">{h.completed}</td>
                          <td className="px-2 py-1 text-right text-indigo-600 dark:text-indigo-400">{h.inProgress}</td>
                          <td className="px-2 py-1 text-right text-muted-foreground">{h.draft}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {/* Summary spark (total) */}
                {sparkTotal && <div className="mt-3"><SparkBar values={sparkTotal.slice(-24)} height={28} /></div>}
              </div>
            ) : <div className="text-xs text-muted-foreground">No metrics history for range</div>}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
  <Card className={`border border-border transition-all duration-700 ${revealed[2] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`} ref={setAppearRef as any} data-anim-index={2}>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">Workflow Summary
            <ReportInfoIcon
              content={REPORT_HELP_TEXTS.workflowSummary}
              id="help-workflowSummary"
              forceInline={helpMode}
              onOpenChange={(o) => o && logTooltipEvent('workflowSummary')}
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Template
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Completed
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Avg. Time
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
                    Success Rate
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {templateUsage.map((template, i) => {
                  const completed = template.completed ?? 0;
                  const avgDays = (template.avgDays ?? 0).toFixed(2);
                  const success = (template.successRatePct ?? 0).toFixed(2);
                  return (
                    <tr key={template.label} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                      <td className="px-4 py-3 text-sm flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                        {template.label}
                      </td>
                      <td className="px-4 py-3 text-sm">{template.value}</td>
                      <td className="px-4 py-3 text-sm">{completed}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{avgDays}d</td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{success}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedReportsDashboard;

