"use client";
import React, { useEffect } from 'react';
import { cn } from '@/lib/utils';

interface DrawerPanelProps {
  side: 'left' | 'right';
  open: boolean;
  width?: number;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export const DrawerPanel: React.FC<DrawerPanelProps> = ({ side, open, width = 300, onClose, children, title }) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);
  return (
    <div
      className={cn(
        'fixed top-0 h-screen z-40 bg-card/90 backdrop-blur-md border-border border flex flex-col shadow-lg',
        'transition-all duration-300 ease-[cubic-bezier(0.22,0.8,0.24,1)]',
        side === 'left' ? 'left-0' : 'right-0',
        open ? 'translate-x-0 opacity-100' : side === 'left' ? '-translate-x-3 opacity-0 pointer-events-none' : 'translate-x-3 opacity-0 pointer-events-none'
      )}
      style={{ width }}
    >
      <div className="flex items-center justify-between px-4 h-12 border-b border-border relative">
        <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground select-none">{title}</span>
        <button
          className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-muted hover:bg-muted/80 text-[11px] font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary/40"
          onClick={onClose}
          aria-label="Close Drawer"
          title="Close"
        >✕</button>
        <button
          onClick={onClose}
          aria-label="Close Drawer"
          title="Close"
          className={cn(
            'absolute -top-3',
            side === 'left' ? '-right-3' : '-left-3',
            'w-8 h-8 rounded-full bg-background/90 shadow ring-1 ring-border flex items-center justify-center text-sm hover:bg-background transition focus:outline-none focus:ring-2 focus:ring-primary/40'
          )}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M4.22 4.22a.75.75 0 011.06 0L10 8.94l4.72-4.72a.75.75 0 111.06 1.06L11.06 10l4.72 4.72a.75.75 0 11-1.06 1.06L10 11.06l-4.72 4.72a.75.75 0 01-1.06-1.06L8.94 10 4.22 5.28a.75.75 0 010-1.06z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-auto p-3 space-y-4">
        {children}
      </div>
    </div>
  );
};
