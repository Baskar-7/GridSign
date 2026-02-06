"use client";
import React from 'react';

interface Series { label: string; values: number[]; color: string; }
interface StackedBarChartProps { categories: string[]; series: Series[]; height?: number; }

const StackedBarChart: React.FC<StackedBarChartProps> = ({ categories, series, height = 180 }) => {
  const totals = categories.map((_,i) => series.reduce((s,ser)=>s+ser.values[i],0));
  return (
    <div className="flex items-end gap-2" style={{ height }} role="figure" aria-label="Stacked bar chart">
      {categories.map((c,i) => {
        const t = totals[i] || 1;
        return (
          <div key={c} className="flex flex-col items-center gap-1 flex-1">
            <div className="w-full flex flex-col justify-end rounded-sm overflow-hidden border border-border bg-muted">
              {series.map(ser => {
                const hPct = (ser.values[i]/t)*100;
                return (
                  <div key={ser.label+c} className="w-full" style={{ height: `${hPct}%`, background: ser.color }} />
                );
              })}
            </div>
            <span className="text-[10px] text-muted-foreground truncate w-full text-center" title={c}>{c}</span>
          </div>
        );
      })}
    </div>
  );
};
export default StackedBarChart;
