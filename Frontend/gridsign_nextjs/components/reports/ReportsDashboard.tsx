"use client";
import React, { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, FileText, Layers, Users, CheckCircle, Clock, Download, Activity, BarChart3, PieChart } from "lucide-react";
import { cn } from "@/lib/utils";
import SparkBar from "./charts/SparkBar";
import StackedBarChart from "./charts/StackedBarChart";
import LegendToggle from "./charts/LegendToggle";

// Tiny SVG chart components (no external chart dependency to avoid React 19 compatibility issues)
interface LineChartProps { data: { label: string; value: number }[]; height?: number; title: string }
const LineChart: React.FC<LineChartProps> = ({ data, height = 160, title }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = (1 - d.value / max) * 100;
    return `${x},${y}`;
  }).join(" ");
  return (
    <div className="relative w-full" role="figure" aria-label={title}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height }} className="w-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id="lc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.6" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <polyline points={points} fill="none" stroke="hsl(var(--primary))" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        <polygon points={`0,100 ${points} 100,100`} fill="url(#lc)" opacity={0.25} />
        {data.map((d,i) => {
          const x = (i / (data.length - 1)) * 100;
          const y = (1 - d.value / max) * 100;
          return <circle key={d.label} cx={x} cy={y} r={1.5} fill="hsl(var(--primary))" />;
        })}
      </svg>
      <div className="absolute inset-0 flex justify-between px-1 text-[10px] text-muted-foreground pointer-events-none select-none">
        {data.map(d => <span key={d.label} className="translate-y-[calc(100%-14px)] rotate-0" aria-hidden="true">{d.label}</span>)}
      </div>
    </div>
  );
};

interface BarChartProps { data: { label: string; value: number }[]; height?: number; title: string }
const BarChart: React.FC<BarChartProps> = ({ data, height = 160, title }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  const barWidth = 100 / data.length;
  return (
    <div className="relative w-full flex items-end gap-1" style={{ height }} role="figure" aria-label={title}>
      {data.map((d, i) => {
        const hPct = (d.value / max) * 100;
        return (
          <div key={d.label} className="flex-1 flex flex-col items-center justify-end gap-1">
            <div className="w-full rounded-sm bg-gradient-to-t from-primary/20 to-primary/60" style={{ height: `${hPct}%` }}>
              <div className="h-full w-full border border-primary/50 rounded-sm" />
            </div>
            <span className="text-[10px] text-muted-foreground truncate w-full text-center" title={d.label}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
};

interface DonutChartProps { data: { label: string; value: number; color: string }[]; title: string }
const DonutChart: React.FC<DonutChartProps> = ({ data, title }) => {
  // Responsive sizing using CSS aspect ratio. Inner radius 70 scaled to viewBox 160.
  const total = data.reduce((s,d)=>s+d.value,0) || 1;
  const circumference = 2 * Math.PI * 70;
  let offset = 0;
  return (
    <div className="relative flex items-center justify-center w-full max-w-[220px] aspect-square" role="figure" aria-label={title}>
      <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
        <circle cx={80} cy={80} r={70} fill="none" stroke="hsl(var(--border))" strokeWidth={10} />
        {data.map(slice => {
          const sliceLength = (slice.value / total) * circumference;
          const el = (
            <circle
              key={slice.label}
              cx={80}
              cy={80}
              r={70}
              fill="transparent"
              stroke={slice.color}
              strokeWidth={10}
              strokeDasharray={`${sliceLength} ${circumference - sliceLength}`}
              strokeDashoffset={-offset}
              strokeLinecap="round"
            />
          );
          offset += sliceLength;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-xs text-muted-foreground">Total</span>
        <span className="text-sm font-semibold">{total}</span>
      </div>
    </div>
  );
};

const ReportsDashboard: React.FC = () => {
  // Date range & export stub
  const [dateRange, setDateRange] = useState("7d");
  const exportReport = () => {
    console.log("Export report clicked");
    // TODO: implement CSV export
  };

  // Mock business intelligence style datasets (replace with API later)
  const workflowTrend = useMemo(() => [
    { label: "Mon", value: 14 },
    { label: "Tue", value: 18 },
    { label: "Wed", value: 22 },
    { label: "Thu", value: 20 },
    { label: "Fri", value: 28 },
    { label: "Sat", value: 12 },
    { label: "Sun", value: 9 },
  ], []);

  const templateUsage = useMemo(() => [
    { label: "NDA", value: 42 },
    { label: "Contract", value: 55 },
    { label: "SOW", value: 18 },
    { label: "Invoice", value: 33 },
    { label: "Purchase Order", value: 27 },
  ], []);

  const statusData = useMemo(() => [
    { label: "Completed", value: 120, color: "#16a34a" },
    { label: "In Progress", value: 34, color: "#6366f1" },
    { label: "Pending", value: 19, color: "#f59e0b" },
    { label: "Expired", value: 6, color: "#dc2626" },
  ], []);

  // Legend state persistence
  const [legendActive, setLegendActive] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
      try { const raw = localStorage.getItem('reports.legendActive'); if (raw) return JSON.parse(raw); } catch {}
    }
    return Object.fromEntries(statusData.map(s => [s.label, true]));
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('reports.legendActive', JSON.stringify(legendActive)); } catch {}
    }
  }, [legendActive]);
  const toggleLegend = (label: string) => setLegendActive(prev => ({ ...prev, [label]: !prev[label] }));
  const filteredStatus = statusData.filter(s => legendActive[s.label]);

  // Stacked bar categories/series
  const stackedCategories = ['Mon','Tue','Wed','Thu','Fri'];
  const stackedSeries = [
    { label: 'Completed', values: [14,18,22,20,28], color: '#16a34a' },
    { label: 'In Progress', values: [6,5,8,7,9], color: '#6366f1' },
    { label: 'Pending', values: [3,4,2,5,4], color: '#f59e0b' },
  ];

  const kpis = useMemo(() => [
    { label: "Total Workflows", value: 198, icon: Layers, spark: [12,14,13,18,22,20,28], subtitle: "↑ 12% from last period" },
    { label: "Documents Signed", value: 120, icon: FileText, spark: [10,11,12,13,14,15,16], subtitle: "87% completion rate" },
    { label: "Avg. Completion Time", value: "3.4d", icon: Clock, spark: [4.2,4.0,3.9,3.8,3.6,3.5,3.4], subtitle: "↓ 0.6d improved" },
    { label: "Active Users", value: 45, icon: Users, spark: [30,31,33,34,38,42,45], subtitle: "↑ 8 new this period" },
  ], []);

  const [loading] = useState(false);
  const isEmpty = workflowTrend.length === 0 || templateUsage.length === 0 || statusData.length === 0;

  return (
    <div className="w-full mx-auto max-w-[1600px] space-y-10 pb-8">
      {/* Header / Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground">Track performance and insights across your workflows.</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={dateRange} onChange={e=>setDateRange(e.target.value)} className="px-3 py-2 border border-border rounded-md bg-background text-sm focus-visible:ring-2 focus-visible:ring-yellow-400">
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <Button onClick={exportReport} variant="outline" size="sm" className="gap-2 bg-gradient-to-r from-[#484B81] to-[#3B4555] text-white hover:opacity-90 focus-visible:ring-2 focus-visible:ring-yellow-400">
            <Download className="h-4 w-4" />Export
          </Button>
        </div>
      </div>

      {/* KPI Cards with Spark Bars */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(k => (
          <Card key={k.label} className="relative overflow-hidden border border-border group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <k.icon className="h-4 w-4 text-muted-foreground" />{k.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-2xl font-bold leading-none tracking-tight">{k.value}</div>
              {Array.isArray(k.spark) && <SparkBar values={k.spark} height={34} color="url(#sparkGradient)" />}
              <p className="text-[11px] text-muted-foreground">{k.subtitle}</p>
            </CardContent>
            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#484B81] to-transparent group-hover:opacity-100 opacity-60 transition" />
          </Card>
        ))}
      </div>

      {loading && (
        <div className="grid gap-4 lg:grid-cols-3" aria-label="Loading charts">
          <Card className="animate-pulse h-64" />
          <Card className="animate-pulse h-64" />
          <Card className="animate-pulse h-64" />
        </div>
      )}

      {!loading && isEmpty && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">No report data available yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Start creating workflows and templates to populate analytics.</p>
        </div>
      )}

      {/* Charts Row 1 */}
      {!loading && !isEmpty && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2"><TrendingUp className="h-4 w-4 text-muted-foreground" />Workflow Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <LineChart data={workflowTrend} title="Weekly workflow activity" />
            </CardContent>
          </Card>
          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2"><BarChart3 className="h-4 w-4 text-muted-foreground" />Template Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <BarChart data={templateUsage} title="Template usage bar chart" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Status Distribution + Stacked Breakdown */}
      {!loading && !isEmpty && (
        <div className="space-y-6">
          <Card className="border border-border">
            <CardHeader className="flex items-start justify-between gap-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2"><Activity className="h-4 w-4 text-muted-foreground" />Status Distribution</CardTitle>
              <LegendToggle items={statusData.map(s => ({ label: s.label, color: s.color, active: legendActive[s.label] }))} onToggle={toggleLegend} />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <BarChart data={filteredStatus.map(({ label, value }) => ({ label, value }))} title="Workflow status distribution" />
                </div>
                <div className="flex items-center justify-center">
                  <div className="relative w-full max-w-[160px] aspect-square">
                    <svg viewBox="0 0 160 160" className="w-full h-full" aria-hidden="true">
                      <circle cx={80} cy={80} r={70} fill="none" stroke="hsl(var(--border))" strokeWidth={12} />
                      {(() => {
                        const total = filteredStatus.reduce((s,d)=>s+d.value,0) || 1;
                        const circumference = 2 * Math.PI * 70;
                        let runningOffset = 0;
                        return filteredStatus.map(slice => {
                          const sliceLength = (slice.value / total) * circumference;
                          const el = (
                            <circle
                              key={slice.label}
                              cx={80}
                              cy={80}
                              r={70}
                              fill="transparent"
                              stroke={slice.color}
                              strokeWidth={12}
                              strokeDasharray={`${sliceLength} ${circumference - sliceLength}`}
                              strokeDashoffset={-runningOffset}
                              strokeLinecap="round"
                            />
                          );
                          runningOffset += sliceLength;
                          return el;
                        });
                      })()}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] text-muted-foreground">Total</span>
                      <span className="text-sm font-semibold">{filteredStatus.reduce((s,d)=>s+d.value,0)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2"><PieChart className="h-4 w-4 text-muted-foreground" />Stacked Daily Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <StackedBarChart categories={stackedCategories} series={stackedSeries} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ReportsDashboard;
