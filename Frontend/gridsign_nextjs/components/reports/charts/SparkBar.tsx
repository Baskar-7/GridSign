"use client";
import React from 'react';

interface SparkBarProps { values: number[]; height?: number; color?: string; }
const SparkBar: React.FC<SparkBarProps> = ({ values, height = 40, color = 'hsl(var(--primary))' }) => {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-[2px]" style={{ height }} aria-hidden="true">
      {values.map((v,i) => (
        <div key={i} className="rounded-sm" style={{
          height: `${(v/max)*100}%`,
          width: '6px',
          background: color,
          opacity: 0.7,
        }} />
      ))}
    </div>
  );
};
export default SparkBar;
