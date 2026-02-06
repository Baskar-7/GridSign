"use client";
import React from 'react';
import { FileText, CalendarDays, User, Hash, RefreshCw, Tag } from 'lucide-react';

export type SortFieldUi = 'workflowName' | 'validUntil' | 'creator' | 'createdDate' | 'updatedDate' | 'status' | 'id';

interface Option {
  value: SortFieldUi;
  label: string;
  icon: React.ReactNode;
  description?: string;
}

const options: Option[] = [
  { value: 'workflowName', label: 'Workflow Name', icon: <FileText className="h-3.5 w-3.5" /> },
  { value: 'validUntil', label: 'Due Date', icon: <CalendarDays className="h-3.5 w-3.5" /> },
  { value: 'creator', label: 'Owner', icon: <User className="h-3.5 w-3.5" /> },
  { value: 'createdDate', label: 'Created On', icon: <CalendarDays className="h-3.5 w-3.5" /> },
  { value: 'updatedDate', label: 'Last Updated', icon: <RefreshCw className="h-3.5 w-3.5" /> },
  { value: 'status', label: 'Status', icon: <Tag className="h-3.5 w-3.5" /> },
  { value: 'id', label: 'Workflow ID', icon: <Hash className="h-3.5 w-3.5" /> },
];

interface Props {
  value: SortFieldUi;
  onChange: (val: SortFieldUi) => void;
  className?: string;
}

// Enhanced dropdown using native <select> for accessibility but with enriched option labels.
// Could be replaced later with a custom popover/command palette without changing external contract.
const SortFieldSelect: React.FC<Props> = ({ value, onChange, className = '' }) => {
  return (
    <div className={`relative inline-flex items-center ${className}`.trim()}>
      <select
        aria-label="Sort workflows by"
        value={value}
        onChange={(e) => onChange(e.target.value as SortFieldUi)}
        className="peer appearance-none h-8 rounded-md border border-border bg-background pr-8 pl-2 text-[10px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground flex items-center">
        <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.52a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z"/></svg>
      </div>
    </div>
  );
};

export const getSortFieldLabel = (field: SortFieldUi): string => {
  const found = options.find(o => o.value === field);
  return found ? found.label : field;
};

export default SortFieldSelect;
