"use client";
import React from 'react';

interface LegendToggleProps { items: { label: string; color: string; active: boolean }[]; onToggle: (label: string) => void; }
const LegendToggle: React.FC<LegendToggleProps> = ({ items, onToggle }) => {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(it => (
        <button
          key={it.label}
          onClick={() => onToggle(it.label)}
          className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-medium transition ${it.active ? 'bg-background shadow-sm' : 'bg-muted/40 text-muted-foreground'}`}
          aria-pressed={it.active}
        >
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: it.color }} />
          {it.label}
        </button>
      ))}
    </div>
  );
};
export default LegendToggle;
