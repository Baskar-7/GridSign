"use client";
import React from 'react';
import { GitFork, ListOrdered } from 'lucide-react';

interface Props {
  isSequential?: boolean;
  className?: string;
  size?: 'xs' | 'sm';
  hideLabelOnSmall?: boolean; // when true, hide text label below sm breakpoint
}

// Reusable badge showing signing mode (Sequential vs Parallel)
// Defaults to Parallel when undefined or false.
const SigningModeBadge: React.FC<Props> = ({ isSequential, className = '', size = 'xs', hideLabelOnSmall = false }) => {
  const sequential = !!isSequential;
  const label = sequential ? 'Sequential' : 'Parallel';
  const Icon = sequential ? ListOrdered : GitFork;
  const base = 'inline-flex items-center gap-1 rounded-md border font-medium';
  const sizing = size === 'xs' ? 'px-1.5 py-0.5 text-[9px]' : 'px-2 py-0.5 text-[10px]';
  const palette = sequential
    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700'
    : 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-700';
  return (
    <span
      className={`${base} ${sizing} ${palette} ${className}`.trim()}
      title={sequential ? 'Signing order enforced sequentially' : 'Recipients can sign in parallel'}
      aria-label={`Signing mode: ${label}`}
    >
      <Icon className={size === 'xs' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      <span className={hideLabelOnSmall ? 'hidden sm:inline' : ''}>{label}</span>
    </span>
  );
};

export default SigningModeBadge;
