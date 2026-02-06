"use client";
import React from 'react';
import { formatDateDDMMYYYY } from '@/lib/utils';
import { Eye, FileText, Layers, Trash2 } from 'lucide-react';
import SigningModeBadge from '../workflows/SigningModeBadge';
import { Button } from '@/components/ui/button';

export interface TemplateGridItem {
  id: string;
  templateName: string;
  category: string;
  owner: string;
  status: string; // active | deprecated | draft
  createdDate: string;
  updatedDate: string;
  usageCount: number;
  isSequentialSigning: boolean;
}

interface Props {
  items: TemplateGridItem[];
  loading?: boolean;
  onUse: (id: string) => void;
  onView?: (id: string) => void; // new handler
  onDelete?: (id: string) => void; // delete handler (draft + unused only)
  highlight?: (text: string) => React.ReactNode;
}

const statusColors: Record<string, { bg: string; text: string; ring: string }> = {
  active: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', ring: 'ring-green-300/40' },
  deprecated: { bg: 'bg-red-50 dark:bg-red-900/25', text: 'text-red-700 dark:text-red-300', ring: 'ring-red-300/40' },
  draft: { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-300', ring: 'ring-gray-300/40' },
};

const TemplateGridView: React.FC<Props> = ({ items, loading, onUse, onView, onDelete, highlight }) => {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-40 rounded-xl border border-border bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
        <FileText className="h-10 w-10 opacity-40" />
        <span className="text-sm">No templates found</span>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map(t => {
        const sc = statusColors[t.status] || statusColors['draft'];
        return (
          <div
            key={t.id}
            className={`group relative rounded-xl border border-border bg-gradient-to-br from-background to-muted/40 hover:shadow-lg transition overflow-hidden ring-1 ring-transparent hover:${sc.ring}`}
          >
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.06),transparent_70%)]" />
            {/* Hover-only delete icon (only for draft & unused) */}
            {onDelete && t.status === 'draft' && t.usageCount === 0 && (
              <button
                type="button"
                onClick={() => onDelete(t.id)}
                title="Delete draft template"
                aria-label="Delete template"
                className="absolute top-2 right-2 h-7 w-7 inline-flex items-center justify-center rounded-md border border-border/60 bg-background/70 backdrop-blur text-muted-foreground hover:text-red-600 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 transition-opacity opacity-0 group-hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <div className="p-4 flex flex-col h-full">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm leading-tight line-clamp-2">
                    {highlight ? highlight(t.templateName) : t.templateName}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <span className="text-[11px] text-muted-foreground font-mono">{t.id.startsWith('temp-') ? t.id : `temp-${t.id}`}</span>
                    <SigningModeBadge hideLabelOnSmall size="xs" isSequential={t.isSequentialSigning} className="shadow-sm" />
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-md text-[10px] font-medium ${sc.bg} ${sc.text} border border-border/40`} aria-label="Template status">{t.status}</span>
              </div>
              {/* Category removed (no category options currently) */}
              <div className="mb-3" />
              <div className="mt-auto flex flex-col gap-2">
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Created: {formatDateDDMMYYYY(t.createdDate)}</span>
                  {t.createdDate !== t.updatedDate && (
                    <span>Updated: {formatDateDDMMYYYY(t.updatedDate)}</span>
                  )}
                </div>
                {/* Owner display */}
                <div className="text-[10px] text-muted-foreground">Owner: {highlight ? highlight(t.owner) : t.owner}</div>
                {/* Signing mode moved to header */}
                <div className="text-[10px] text-muted-foreground">Used {t.usageCount} time{t.usageCount === 1 ? '' : 's'}</div>
                <div className="flex items-center justify-center gap-3 mt-2 pt-1">
                  <Button
                    size="sm"
                    title="Create a workflow from this template"
                    className="use-template-btn h-8"
                    onClick={() => onUse(t.id)}
                    aria-label="Use template"
                  >
                    <Layers className="btn-icon" />
                    <span>Use Template</span>
                  </Button>
                  <Button
                    size="sm"
                    title="View template details"
                    className="inline-flex items-center gap-1 h-8 px-2 text-[10px] font-medium bg-muted/50 hover:bg-muted border border-border/60 rounded-md focus-visible:ring-2 focus-visible:ring-indigo-300/40 text-foreground shadow-sm transition"
                    onClick={() => onView && onView(t.id)}
                    aria-label="View template"
                  >
                    <Eye className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-300" /> View Template
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TemplateGridView;
