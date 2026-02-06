"use client";
import React, { useMemo, useState } from 'react';
import { formatDateDDMMYYYY } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  SortingState,
} from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Eye, ArrowUpDown, User, Play, Square, Trash2 } from 'lucide-react';
import SigningModeBadge from './SigningModeBadge';

export interface WorkflowDataRow {
  id: string;
  workflowName: string;
  templateName: string;
  creator: string;
  status: string;
  createdDate: string;
  updatedDate: string;
  validUntil?: string;
  daysRemaining?: number;
  isExpired?: boolean;
  isSequentialSigningEnabled?: boolean;
}

interface Props {
  data: WorkflowDataRow[];
  loading?: boolean;
  highlight?: (text: string) => React.ReactNode;
  onView: (id: string) => void;
  onStart?: (id: string) => void; // lifecycle start (draft -> in-progress)
  onStop?: (id: string) => void;  // lifecycle stop (in-progress -> cancelled)
  onDelete?: (id: string) => void; // request deletion
}

const statusClasses: Record<string, string> = {
  completed: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  'in-progress': 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  failed: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  cancelled: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  draft: 'bg-gray-50 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

const WorkflowDataTable: React.FC<Props> = ({ data, loading, highlight, onView, onStart, onStop, onDelete }) => {
  const router = useRouter();
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdDate', desc: true }]);

  const columns = useMemo<ColumnDef<WorkflowDataRow>[]>(() => [
    {
      id: 'workflowName',
      accessorKey: 'workflowName',
      header: () => <span>Name</span>,
      cell: ({ row }) => <div className="font-medium text-sm">{highlight ? highlight(row.original.workflowName) : row.original.workflowName}</div>,
    },
    {
      id: 'templateName',
      accessorKey: 'templateName',
      header: () => <span>Template</span>,
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{highlight ? highlight(row.original.templateName) : row.original.templateName}</span>,
    },
    {
      id: 'creator',
      accessorKey: 'creator',
      header: () => <span>Creator</span>,
      cell: ({ row }) => (
        <span className="flex items-center gap-1 text-xs text-muted-foreground"><User className="h-3 w-3" /> {highlight ? highlight(row.original.creator) : row.original.creator} <SigningModeBadge className="ml-1" size="xs" isSequential={row.original.isSequentialSigningEnabled} /></span>
      ),
    },
    {
      id: 'daysRemaining',
      accessorKey: 'daysRemaining',
      header: () => <span>Days Left</span>,
      cell: ({ row }) => {
        const d = row.original.daysRemaining;
        const expired = row.original.isExpired;
        if (d === undefined) return <span className="text-[10px] text-muted-foreground">-</span>;
        const base = 'px-2 py-1 rounded-md text-[10px] font-medium border';
        if (expired) return <span className={base + ' bg-red-50 border-red-200 text-red-600 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300'}>Expired</span>;
        if (d === 0) return <span className={base + ' bg-amber-50 border-amber-200 text-amber-700'}>Today</span>;
        if (d === 1) return <span className={base + ' bg-amber-50 border-amber-200 text-amber-700'}>1d</span>;
        if (d <= 3) return <span className={base + ' bg-yellow-50 border-yellow-200 text-yellow-700'}>{d}d</span>;
        return <span className={base + ' bg-muted/40 border-border/60 text-muted-foreground'}>{d}d</span>;
      },
      sortingFn: (a,b,columnId) => (a.getValue<number | undefined>(columnId) ?? 9999) - (b.getValue<number | undefined>(columnId) ?? 9999),
    },
    {
      id: 'validUntil',
      accessorKey: 'validUntil',
      header: () => <span>Due</span>,
  cell: ({ row }) => <span className={'text-[10px] ' + (row.original.isExpired ? 'text-red-600 font-medium' : 'text-muted-foreground')}>{row.original.validUntil ? formatDateDDMMYYYY(row.original.validUntil) : '-'}</span>,
      sortingFn: (a,b,columnId) => new Date(a.getValue<string>(columnId)).getTime() - new Date(b.getValue<string>(columnId)).getTime(),
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: () => <span>Status</span>,
      cell: ({ row }) => (
        <span className={`px-2 py-1 rounded-md text-[10px] font-medium border border-border/40 ${statusClasses[row.original.status]}`}>{row.original.status}</span>
      ),
      sortingFn: (a, b, columnId) => a.getValue<string>(columnId).localeCompare(b.getValue<string>(columnId)),
    },
    {
      id: 'createdDate',
      accessorKey: 'createdDate',
      header: ({ column }) => (
        <button
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="flex items-center gap-1"
        >
          Created <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
  cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDateDDMMYYYY(row.original.createdDate)}</span>,
      sortingFn: (a, b, columnId) => new Date(a.getValue<string>(columnId)).getTime() - new Date(b.getValue<string>(columnId)).getTime(),
    },
    {
      id: 'updatedDate',
      accessorKey: 'updatedDate',
      header: ({ column }) => (
        <button
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="flex items-center gap-1"
        >
          Updated <ArrowUpDown className="h-3.5 w-3.5" />
        </button>
      ),
  cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDateDDMMYYYY(row.original.updatedDate)}</span>,
      sortingFn: (a, b, columnId) => new Date(a.getValue<string>(columnId)).getTime() - new Date(b.getValue<string>(columnId)).getTime(),
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex items-center gap-1">
            {r.status === 'draft' && (
              <Button
                size="sm"
                variant="outline"
                disabled={!onStart}
                aria-label="Start workflow"
                title="Start workflow"
                className="h-7 w-7 px-0 flex items-center justify-center hover:bg-indigo-600/10 hover:text-indigo-600"
                onClick={() => onStart && onStart(r.id)}
              >
                <Play className="h-3.5 w-3.5" />
              </Button>
            )}
            {r.status === 'in-progress' && (
              <Button
                size="sm"
                variant="outline"
                disabled={!onStop}
                aria-label="Stop workflow"
                title="Stop workflow"
                className="h-7 w-7 px-0 flex items-center justify-center hover:bg-rose-600/10 hover:text-rose-600"
                onClick={() => onStop && onStop(r.id)}
              >
                <Square className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              aria-label="View workflow"
              title="View workflow"
              className="h-7 w-7 px-0 flex items-center justify-center hover:bg-primary/10 hover:text-primary"
              onClick={() => onView(r.id)}
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
            {onDelete && ['draft','completed','cancelled'].includes(r.status) && (
              <Button
                size="sm"
                variant="outline"
                aria-label="Delete workflow"
                title="Delete workflow"
                className="h-7 w-7 px-0 flex items-center justify-center text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                onClick={() => onDelete(r.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        );
      },
      enableSorting: false,
    },
  ], [highlight, onView]);

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    globalFilterFn: (row, columnId, filterValue) => {
      if (!filterValue) return true;
      const search = String(filterValue).toLowerCase();
      return Object.values(row.original).some(val => String(val).toLowerCase().includes(search));
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Input
            placeholder="Global search..."
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            className="pl-3"
          />
        </div>
        <span className="text-xs text-muted-foreground">{table.getFilteredRowModel().rows.length} rows</span>
      </div>
      <div className="rounded-md border border-border overflow-auto max-h-[60vh]">        
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/60 backdrop-blur z-10 text-xs">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id} className="text-muted-foreground">
                {hg.headers.map(header => (
                  <th key={header.id} className="font-medium text-left px-4 py-2 select-none">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {columns.map(col => (
                    <td key={String(col.id)+i} className="px-4 py-3"><div className="h-4 w-24 bg-muted rounded" /></td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-16">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <span className="text-sm">No workflows found</span>
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr key={row.id} className="group border-t border-border/60 hover:bg-muted/40 transition-colors">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-4 py-3 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WorkflowDataTable;
