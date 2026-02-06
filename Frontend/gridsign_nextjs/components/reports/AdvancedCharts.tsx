"use client";
import React from 'react';
import {
  ResponsiveContainer,
  AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend, RadialBarChart, RadialBar
} from 'recharts';

interface AreaSeriesPoint { name: string; value: number; }
interface StatusSlice { label: string; value: number; color: string; }

// Central accessible palette (WCAG-friendly contrast on light/dark backgrounds)
export const CHART_COLORS = [
  '#2563eb', // blue-600
  '#16a34a', // green-600
  '#f59e0b', // amber-500
  '#dc2626', // red-600
  '#7c3aed', // violet-600
  '#0891b2', // cyan-600
  '#d946ef', // fuchsia-500
  '#f97316', // orange-500
];

export const AdvancedArea: React.FC<{ data: AreaSeriesPoint[]; stroke?: string; fill?: string; title?: string; animateKey?: string; reducedMotion?: boolean; }> = ({ data, stroke = 'hsl(var(--primary))', fill = 'hsl(var(--primary))', title, animateKey, reducedMotion }) => (
  <div className="h-72 w-full flex flex-col">
    {title && <h3 className="text-xs font-medium mb-2 text-muted-foreground">{title}</h3>}
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} key={animateKey}>
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={fill} stopOpacity={0.45} />
            <stop offset="95%" stopColor={fill} stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={30} />
        <RTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: '11px' }} />
        <Area type="monotone" dataKey="value" stroke={stroke} fillOpacity={1} fill="url(#areaGradient)" strokeWidth={2}
          isAnimationActive={!reducedMotion} animationDuration={900} animationBegin={50} />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

// Custom tooltip renderer when gray styling requested
// Lightweight explicit typing to avoid depending on Recharts TooltipProps (namespace typing can fail under skipLibCheck)
interface GrayTPayloadEntry { dataKey?: string | number; name?: string; value?: number; color?: string; }
interface GrayTooltipArgs { active?: boolean; label?: string; payload?: GrayTPayloadEntry[]; }
const GrayTooltip: React.FC<GrayTooltipArgs> = ({ active, label, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-md border px-2 py-1.5 shadow-md backdrop-blur-sm bg-white/70 dark:bg-slate-900/60 transition-colors"
      style={{ borderColor: 'hsl(var(--border))' }}
    >
      <div className="text-[11px] font-medium text-gray-600 dark:text-gray-400">{label}</div>
      {payload.map((p, idx) => (
        <div key={String(p.dataKey) + idx} className="flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-400">
          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: p.color }} />
          <span>{p.name}: {p.value}</span>
        </div>
      ))}
    </div>
  );
};

export const AdvancedBar: React.FC<{ data: any[]; title?: string; bars: { dataKey: string; color?: string; name?: string }[]; indexKey?: string; stacked?: boolean; categorical?: boolean; animateKey?: string; reducedMotion?: boolean; tooltipGray?: boolean; labelTruncateLength?: number; labelEllipsis?: string; }> = ({ data, title, bars, indexKey = 'name', stacked, categorical, animateKey, reducedMotion, tooltipGray, labelTruncateLength = 14, labelEllipsis = '....' }) => {
  // Custom tick renderer to truncate labels without shifting alignment
  const Tick: React.FC<any> = ({ x, y, payload }) => {
    const raw = String(payload.value ?? '');
    const truncated = raw.length > labelTruncateLength ? raw.slice(0, labelTruncateLength) + labelEllipsis : raw;
    return (
      <text x={x} y={y + 10} textAnchor="middle" fontSize={11} fill="hsl(var(--muted-foreground))" className="select-none pointer-events-none">
        {truncated}
      </text>
    );
  };
  return (
  <div className="h-72 w-full flex flex-col">
    {title && <h3 className="text-xs font-medium mb-2 text-muted-foreground">{title}</h3>}
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 20 }} key={animateKey}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey={indexKey} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} tick={false} height={10} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={30} />
        {tooltipGray ? (
          <RTooltip content={<GrayTooltip />} />
        ) : (
          <RTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: '11px' }} />
        )}
        <Legend wrapperStyle={{ fontSize: '11px' }} />
        {bars.map((b, bi) => (
          <Bar key={b.dataKey} dataKey={b.dataKey} name={b.name}
            stackId={stacked ? 'a' : undefined} radius={[4,4,0,0]}
            fill={b.color || CHART_COLORS[bi % CHART_COLORS.length]}
            isAnimationActive={!reducedMotion} animationDuration={750} animationBegin={80}>
            {categorical && data.map((d: any, i: number) => (
              <Cell key={i} fill={d.color || CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  </div>
  );
};

export const AdvancedDonut: React.FC<{ data: StatusSlice[]; title?: string; animateKey?: string; reducedMotion?: boolean; }> = ({ data, title, animateKey, reducedMotion }) => {
  const total = data.reduce((s,d)=>s+d.value,0) || 1;
  return (
    <div className="h-72 w-full flex flex-col items-center justify-center relative">
      {title && <h3 className="text-xs font-medium mb-2 text-muted-foreground self-start">{title}</h3>}
      <ResponsiveContainer width="100%" height="100%">
        <PieChart key={animateKey}>
          <RTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: '11px' }} />
          <Legend wrapperStyle={{ fontSize: '11px' }} />
          <Pie data={data} dataKey="value" nameKey="label" innerRadius={55} outerRadius={80} strokeWidth={2} paddingAngle={3}
            isAnimationActive={!reducedMotion} animationDuration={800} animationBegin={100}>
            {data.map((entry, i) => <Cell key={entry.label} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
        <span className="text-[10px] text-muted-foreground">Total</span>
        <span className="text-sm font-semibold">{total}</span>
      </div>
    </div>
  );
};

export const RadialGauge: React.FC<{ value: number; max?: number; label?: string; color?: string; animateKey?: string; reducedMotion?: boolean; }> = ({ value, max = 100, label='Completion', color, animateKey, reducedMotion }) => {
  const pct = Math.max(0, Math.min(1, value / max));
  const gaugeColor = color || CHART_COLORS[0];
  const chartData = [{ name: label, value: pct * 100, fill: gaugeColor }];
  return (
    <div className="h-64 w-full flex flex-col relative" key={animateKey}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart innerRadius="65%" outerRadius="100%" data={chartData} startAngle={90} endAngle={-270}>
          <RadialBar background clockWise dataKey="value" cornerRadius={6} isAnimationActive={!reducedMotion} animationDuration={850} animationBegin={120} />
          <RTooltip formatter={(val: any) => [`${Math.round(val)}%`, label]} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: '11px' }} />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-2xl font-semibold">{Math.round(pct * 100)}%</span>
        <span className="text-[11px] text-muted-foreground">{label}</span>
      </div>
    </div>
  );
};

export default function AdvancedChartsShowcase() { return null; }