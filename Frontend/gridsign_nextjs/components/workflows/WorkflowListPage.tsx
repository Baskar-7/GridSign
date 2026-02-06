"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import WorkflowGridView from './WorkflowGridView';
import { AlertTriangle, Trash2 } from 'lucide-react';
import WorkflowKanbanBoard from './WorkflowKanbanBoard';
import WorkflowDataTable from './WorkflowDataTable';
import WorkflowActivityFeed from './WorkflowActivityFeed';
import SortFieldSelect, { getSortFieldLabel } from './SortFieldSelect';
import StatusOverview from './StatusOverview';
import VirtualizedWorkflowList from './VirtualizedWorkflowList';
import SigningModeBadge from './SigningModeBadge'; 
import { Card } from "@/components/ui/card"; // layout containers
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import {
  Search,
  Eye,
  Filter,
  Loader2,
  ArrowUpDown,
  CalendarDays,
  FileText,
  User,
  LayoutGrid,
  Layers,
  KanbanSquare,
  Table,
  SplitSquareHorizontal,
  Activity,
  BarChart3,
  ChevronRight,
  FilePlus,
  Play,
  Square
} from "lucide-react";

// API types & mapper
import { ApiResponseRaw, PagedResponseRaw, WorkflowSummaryRaw, mapWorkflowSummaryRawToUI, WorkflowRecordUI, uiStatusToBackend } from "@/types/workflow";
import { toast } from "sonner";
import { apiUrl } from '@/lib/apiConfig';
import { useApiQuery } from "@/hooks/useApiQuery";
import SendForSignaturePage from "@/components/send-for-signature/SendForSignaturePage";
// Normalized UI record alias
const statusMeta: Record<WorkflowRecordUI["status"], { label: string; color: string; bg: string; border: string; icon?: React.ReactNode }> = {
  completed: {
    label: "Completed",
    color: "text-green-600",
    bg: "bg-green-50",
    border: "border-green-200",
    icon: <span className="w-2 h-2 rounded-full bg-green-500" />,
  },
  "in-progress": {
    label: "In Progress",
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    icon: <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />,
  },
  expired: {
    label: "Expired",
    color: "text-slate-700",
    bg: "bg-slate-50",
    border: "border-slate-200",
    icon: <span className="w-2 h-2 rounded-full bg-slate-500" />,
  },
  cancelled: {
    label: "Cancelled",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    icon: <span className="w-2 h-2 rounded-full bg-red-400" />,
  },
  draft: {
    label: "Draft",
    color: "text-gray-600",
    bg: "bg-gray-50",
    border: "border-gray-200",
    icon: <span className="w-2 h-2 rounded-full bg-gray-400" />,
  },
  failed: {
    label: "Failed",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-200",
    icon: <span className="w-2 h-2 rounded-full bg-red-500" />,
  },
};

// Primary ordering list (excludes legacy "failed" from normal iteration/filter chips)
const uiStatusOrder: WorkflowRecordUI["status"][] = ["completed","in-progress","draft","expired","cancelled"];

// Fallback badge component if shadcn Badge doesn't exist
const StatusBadge: React.FC<{ status: WorkflowRecordUI["status"] }> = ({ status }) => {
  const meta = statusMeta[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${meta.bg} ${meta.color} ${meta.border}`}
    >
      {meta.icon}
      {meta.label}
    </span>
  );
};

  const formatDate = (iso: string) => {
    // Unified dd/MM/yyyy formatting
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const day = String(d.getDate()).padStart(2,'0');
    const month = String(d.getMonth()+1).padStart(2,'0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatDateShort = (iso: string) => {
    // Same as full format to satisfy global dd/MM/yyyy requirement
    return formatDate(iso);
  };
  const formatDaysRemaining = (days: number) => {
    if (days < 0) return 'Expired';
    if (days === 0) return 'Today';
    if (days === 1) return '1 day';
    return `${days} days`;
  };

const WorkflowListPage: React.FC = () => {
  const router = useRouter();
  const [loadedPrefs, setLoadedPrefs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Removed primary dropdown status filter; chip set is now sole status filtering mechanism
  const [statusSet, setStatusSet] = useState<Set<WorkflowRecordUI["status"]>>(new Set());
  // Expanded sort options to match backend capabilities
  // Backend expects lowercase keys: workflowname, validuntil, status, workflowowner, createdon, lastupdateddate, workflowid
  type SortField = 'workflowName' | 'validUntil' | 'status' | 'creator' | 'createdDate' | 'updatedDate' | 'id';
  const [sortBy, setSortBy] = useState<SortField>('createdDate');
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showSortMenu, setShowSortMenu] = useState(false);
  // Removed density toggle for streamlined professional layout
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<WorkflowRecordUI["status"]>>(new Set());
  const [viewMode, setViewMode] = useState<'grouped' | 'grid' | 'kanban' | 'datatable' | 'hybrid' | 'activity' | 'analytics'>('grid');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [mutableData, setMutableData] = useState<WorkflowRecordUI[]>([]);
  const [showCreateInlineWorkflow, setShowCreateInlineWorkflow] = useState(false);
  // Deletion dialog (shared across all views)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Show status filters panel by default per user request
  const [showStatusFilters, setShowStatusFilters] = useState<boolean>(true);
  // Paged meta from backend
  const [totalCount, setTotalCount] = useState<number>(0);
  // Pagination state (must be declared before requestHeaders usage)
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  // Load saved preferences (view, filters, sort, search) for workflows
  useEffect(() => {
    try {
      const raw = localStorage.getItem('gridsignPrefs');
      if (raw) {
        const prefs = JSON.parse(raw);
        const allowedViews = ['grouped','grid','kanban','datatable','hybrid','activity','analytics'];
        if (prefs.workflowViewMode && allowedViews.includes(prefs.workflowViewMode)) setViewMode(prefs.workflowViewMode);
        if (prefs.sortWorkflow && prefs.sortWorkflow.field) {
          const fld = prefs.sortWorkflow.field as SortField;
          if (['workflowName','validUntil','status','creator','createdDate','updatedDate','id'].includes(fld)) {
            setSortBy(fld);
            if (prefs.sortWorkflow.dir === 'asc' || prefs.sortWorkflow.dir === 'desc') setSortDir(prefs.sortWorkflow.dir);
          }
        }
        if (typeof prefs.searchWorkflow === 'string') setSearch(prefs.searchWorkflow);
        if (Array.isArray(prefs.workflowStatusFilters) && prefs.workflowStatusFilters.length) {
          const validStatuses = prefs.workflowStatusFilters.filter((s: WorkflowRecordUI['status']) => uiStatusOrder.includes(s));
          setStatusSet(new Set(validStatuses));
        }
      }
    } catch {}
    setLoadedPrefs(true);
  }, []);
  // Baseline preference initialization after load
  useEffect(() => {
    if (!loadedPrefs) return;
    try {
      const raw = localStorage.getItem('gridsignPrefs');
      const prefs = raw ? JSON.parse(raw) : {};
      if (!prefs.workflowViewMode) prefs.workflowViewMode = viewMode;
      if (!prefs.workflowStatusFilters) prefs.workflowStatusFilters = Array.from(statusSet);
      if (!prefs.sortWorkflow) prefs.sortWorkflow = { field: sortBy, dir: sortDir };
      if (!prefs.searchWorkflow) prefs.searchWorkflow = search;
      prefs.lastPage = '/workflows';
      prefs.updatedAt = new Date().toISOString();
      localStorage.setItem('gridsignPrefs', JSON.stringify(prefs));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedPrefs]);

  // Persist preference deltas after load
  useEffect(() => {
    if (!loadedPrefs) return;
    try {
      const raw = localStorage.getItem('gridsignPrefs');
      const prefs = raw ? JSON.parse(raw) : {};
      prefs.workflowViewMode = viewMode;
      prefs.workflowStatusFilters = Array.from(statusSet);
      prefs.sortWorkflow = { field: sortBy, dir: sortDir };
      prefs.searchWorkflow = search;
      prefs.lastPage = '/workflows';
      prefs.updatedAt = new Date().toISOString();
      localStorage.setItem('gridsignPrefs', JSON.stringify(prefs));
      window.dispatchEvent(new StorageEvent('storage', { key: 'gridsignPrefs', newValue: JSON.stringify(prefs) }));
    } catch {}
  }, [loadedPrefs, viewMode, statusSet, sortBy, sortDir, search, currentPage, pageSize]);

  // Construct API root (ensure /api prefix matches backend Route("api/workflow"))
  const baseUrl = process.env.NEXT_PUBLIC_LOCAL_API_URL || 'http://localhost:3000';
  const trimmedBase = baseUrl.endsWith('/') ? baseUrl.slice(0,-1) : baseUrl;
  const apiRoot = /\/api$/i.test(trimmedBase) ? trimmedBase : `${trimmedBase}/api`;

  // Build backend status array; map legacy 'failed' to Expired (4) for now
  const backendStatusesArray = useMemo(() => {
    if (statusSet.size === 0) return [] as number[];
    return Array.from(statusSet).map(s => uiStatusToBackend(s));
  }, [statusSet]);

  const backendSortKey = (field: SortField): string => {
    switch (field) {
      case 'workflowName': return 'workflowname';
      case 'validUntil': return 'validuntil';
      case 'status': return 'status';
      case 'creator': return 'workflowowner';
      case 'createdDate': return 'createdon';
      case 'updatedDate': return 'lastupdateddate';
      case 'id': return 'workflowid';
      default: return 'createdon';
    }
  };

  const requestHeaders = useMemo(() => ({
    PageNumber: currentPage,
    PageSize: pageSize,
    SearchTerm: search || undefined,
    SortBy: backendSortKey(sortBy),
    IsDescending: sortDir === 'desc',
    // For backend compatibility we ALSO send selected statuses as a comma-separated header.
    // If backend expects a different key (e.g., "Status" for single or "Statuses" for multi), adjust here.
    // Current assumption: controller can read Request.Headers["Statuses"] and split by comma.
    Statuses: backendStatusesArray.length > 0 ? backendStatusesArray.join(',') : undefined,
    // Provide a legacy/single header variant as well for maximum compatibility.
    Status: backendStatusesArray.length > 0 ? backendStatusesArray.join(',') : undefined,
  }), [currentPage, pageSize, search, sortBy, sortDir, backendStatusesArray]);

  // React Query-based fetch eliminates manual re-fetch loops
  // Build query string redundancy so backend can read either headers or query params.
  const requestQueryString = useMemo(() => {
    const qp = new URLSearchParams();
    qp.set('pageNumber', String(currentPage));
    qp.set('pageSize', String(pageSize));
  qp.set('sortBy', backendSortKey(sortBy));
    qp.set('isDescending', String(sortDir === 'desc'));
    if (search) qp.set('searchTerm', search);
    if (backendStatusesArray.length > 0) qp.set('statuses', backendStatusesArray.join(','));
    return qp.toString();
  }, [currentPage, pageSize, sortBy, sortDir, search, backendStatusesArray]);

  // Debug: surface what we're sending
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.debug('[WorkflowListPage] request headers:', requestHeaders, 'query:', requestQueryString);
    }
  }, [requestHeaders, requestQueryString]);

  // Inspect status state transitions explicitly
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.debug('[WorkflowListPage] statusSet ->', Array.from(statusSet), 'backendStatusesArray ->', backendStatusesArray);
    }
  }, [statusSet, backendStatusesArray]);
  const workflowsQuery = useApiQuery<{
  items: WorkflowRecordUI[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}>({
  queryKey: [
    'workflows',
    currentPage,
    pageSize,
    search,
    sortBy,
    sortDir,
    backendStatusesArray.sort().join('-'),
  ],
  method: 'POST',
  url: `${apiRoot}/workflow/getWorkflows`, // Updated endpoint
  body: {
    PageNumber: currentPage,
    PageSize: pageSize,
    SearchTerm: search || '',
    SortBy: backendSortKey(sortBy),
    IsDescending: sortDir === 'desc',
    Statuses: backendStatusesArray.length > 0 ? backendStatusesArray : null,
  },
  config: {
    headers: Object.fromEntries(
      Object.entries(requestHeaders)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)])
    ),
  },
  enabled: typeof window !== 'undefined' && !!localStorage.getItem('token'),
  staleTime: 10_000,
  transform: (raw: any) => {
    try {
      const rawValues: WorkflowSummaryRaw[] = raw?.items?.$values ?? [];
      const mapped = rawValues.map(mapWorkflowSummaryRawToUI);

      return {
        items: mapped,
        totalCount: raw?.totalCount || mapped.length,
        pageNumber: raw?.pageNumber || currentPage,
        pageSize: raw?.pageSize || pageSize,
      };
    } catch (e) {
      toast.error('Failed to transform workflows response');
      return { items: [], totalCount: 0, pageNumber: currentPage, pageSize };
    }
  },
});

  const loading = workflowsQuery.isLoading;
  const apiData = workflowsQuery.data?.data;

  // Handle error side-effects (toast) centrally
  useEffect(() => {
    const err = workflowsQuery.error;
    if (err) {
      const statusCode = (err as any)?.response?.status; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (statusCode === 401) {
        setError('Unauthorized – please sign in again.');
        toast.error('Session Expired');
        setTimeout(() => { if (typeof window !== 'undefined') window.location.href = '/signin'; }, 1000);
      } else {
        setError(err.message || 'Failed to load workflows');
        toast.error(err.message || 'Failed to load workflows');
      }
    } else if (apiData) {
      setError(null);
    }
  }, [workflowsQuery.error, apiData]);

  useEffect(() => {
    if (apiData) {
      setMutableData(apiData.items);
      setTotalCount(apiData.totalCount);
    }
  }, [apiData]);

  // Rely on backend for search & status filtering; use data as-is
  const filtered = mutableData;

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      // Custom handling per field
      switch (sortBy) {
        case 'status': {
          const order: WorkflowRecordUI['status'][] = ['completed','in-progress','draft','expired','cancelled','failed'];
          const ai = order.indexOf(a.status);
          const bi = order.indexOf(b.status);
          return sortDir === 'asc' ? ai - bi : bi - ai;
        }
        case 'workflowName': {
          const av = a.workflowName.localeCompare(b.workflowName);
          return sortDir === 'asc' ? av : -av;
        }
        case 'creator': {
          const av = a.creator.localeCompare(b.creator);
          return sortDir === 'asc' ? av : -av;
        }
        case 'validUntil': {
          const av = a.validUntil ? new Date(a.validUntil).getTime() : 0;
          const bv = b.validUntil ? new Date(b.validUntil).getTime() : 0;
          return sortDir === 'asc' ? av - bv : bv - av;
        }
        case 'createdDate': {
          const av = new Date(a.createdDate).getTime();
          const bv = new Date(b.createdDate).getTime();
          return sortDir === 'asc' ? av - bv : bv - av;
        }
        case 'updatedDate': {
          const av = new Date(a.updatedDate).getTime();
          const bv = new Date(b.updatedDate).getTime();
          return sortDir === 'asc' ? av - bv : bv - av;
        }
        case 'id': {
          // Assuming UUID-like; lexical compare is fine
          const av = a.id.localeCompare(b.id);
          return sortDir === 'asc' ? av : -av;
        }
        default: return 0;
      }
    });
    return arr;
  }, [filtered, sortBy, sortDir]);
  // Start workflow (draft -> in-progress)
  const handleStartWorkflow = async (id: string) => {
    // Extract numeric workflowId from formatted id (e.g. "wf-123")
    const numericId = (() => {
      const m = /^wf-(\d+)$/.exec(id.trim());
      return m ? parseInt(m[1], 10) : NaN;
    })();
    if (Number.isNaN(numericId)) {
      toast.error('Invalid workflow identifier');
      return;
    }
    setMutableData(data => data.map(w => w.id === id ? { ...w, status: 'in-progress', updatedDate: new Date().toISOString() } : w));
    try {
      // Unified workflow action endpoint (Start = 0)
      const endpoint = apiUrl('/api/workflow/action');
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token? { Authorization: `Bearer ${token}` }: {}) },
        body: JSON.stringify({ workflowId: numericId, action: 0 })
      });
      if (!res.ok) throw new Error('Failed to start workflow');
      toast.success('Workflow started');
    } catch (e:any) {
      toast.error(e.message || 'Start failed');
      // revert optimistic change
      setMutableData(data => data.map(w => w.id === id ? { ...w, status: 'draft' } : w));
    }
  };
  // Cancel workflow (in-progress -> cancelled, irreversible)
  const handleCancelWorkflow = async (id: string) => {
    const numericId = (() => {
      const m = /^wf-(\d+)$/.exec(id.trim());
      return m ? parseInt(m[1], 10) : NaN;
    })();
    if (Number.isNaN(numericId)) {
      toast.error('Invalid workflow identifier');
      return;
    }
    setMutableData(data => data.map(w => w.id === id ? { ...w, status: 'cancelled', updatedDate: new Date().toISOString() } : w));
    try {
      // Unified workflow action endpoint (Cancel = 1)
      const endpoint = apiUrl('/api/workflow/action');
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token? { Authorization: `Bearer ${token}` }: {}) },
        body: JSON.stringify({ workflowId: numericId, action: 1 })
      });
      if (!res.ok) throw new Error('Failed to cancel workflow');
      toast.success('Workflow cancelled');
    } catch (e:any) {
      toast.error(e.message || 'Cancellation failed');
      // revert optimistic change
      setMutableData(data => data.map(w => w.id === id ? { ...w, status: 'in-progress' } : w));
    }
  };
  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalCount / pageSize)), [totalCount, pageSize]);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);
  const goToPage = (p: number) => setCurrentPage(Math.min(Math.max(1, p), totalPages));
  // Group workflows by status after sorting
  const grouped = useMemo(() => {
    const groups: Record<WorkflowRecordUI['status'], WorkflowRecordUI[]> = {
      completed: [], 'in-progress': [], draft: [], expired: [], cancelled: [], failed: []
    };
    for (const wf of sorted) {
      if (!groups[wf.status]) groups[wf.status] = [];
      groups[wf.status].push(wf);
    }
    return groups;
  }, [sorted]);

  const highlight = (text: string) => {
    if (!search) return text;
    const idx = text.toLowerCase().indexOf(search.toLowerCase());
    if (idx === -1) return text;
    return (
      <span>
        {text.slice(0, idx)}
        <span className="bg-yellow-200 dark:bg-yellow-600/40 px-0.5 rounded-sm">{text.slice(idx, idx + search.length)}</span>
        {text.slice(idx + search.length)}
      </span>
    );
  };

  const toggleGroup = (status: WorkflowRecordUI['status']) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status); else next.add(status);
      return next;
    });
  };

  const statusBorderClass = (s: WorkflowRecordUI['status']) => {
    switch (s) {
      case 'completed': return 'border-l-green-500';
      case 'in-progress': return 'border-l-blue-500';
  case 'expired': return 'border-l-slate-500';
  case 'failed': return 'border-l-red-500';
      case 'cancelled': return 'border-l-red-400';
      case 'draft': return 'border-l-gray-400';
      default: return 'border-l-muted';
    }
  };

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDir("desc");
    }
  };

  return (
    <div className="w-full h-full flex flex-col gap-6 p-6">
      {showCreateInlineWorkflow ? (
        <div className="flex flex-col gap-4">
          <nav aria-label="Breadcrumb" className="text-[11px] flex items-center gap-1 text-muted-foreground">
            <button type="button" onClick={() => setShowCreateInlineWorkflow(false)} className="hover:underline">Workflows</button>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">New Workflow</span>
          </nav>
          <div className="rounded-lg border border-border bg-card/80 backdrop-blur-sm shadow-sm p-2">
            {/* Use explicit workflow creation labeling */}
            <SendForSignaturePage modeOverride="workflow-create" onCancelEmbed={() => setShowCreateInlineWorkflow(false)} />
          </div>
        </div>
      ) : (
        <>
          {/* Page heading + action */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Workflows</h1>
              <p className="text-xs text-muted-foreground">Search, filter and switch views of signing workflows</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="h-8 px-3 text-[11px] font-medium tracking-tight whitespace-nowrap inline-flex items-center gap-1 bg-background border border-border hover:bg-yellow-100 hover:border-yellow-300 dark:hover:bg-yellow-300/20 dark:hover:border-yellow-400/40 text-foreground shadow-sm focus-visible:ring-2 focus-visible:ring-yellow-300/60 dark:focus-visible:ring-yellow-400/50 transition-colors"
                aria-label="Create a new workflow"
                onClick={() => setShowCreateInlineWorkflow(true)}
              >
                <FilePlus className="h-3.5 w-3.5" />
                New Workflow
              </Button>
            </div>
          </div>
  {/* Unified sticky dock: controls left, view modes grid right */}
  <Card className="sticky top-0 z-20 border border-border/70 bg-card/90 backdrop-blur px-4 py-4 flex flex-col gap-4 shadow-sm rounded-lg">
    <div className="flex flex-col gap-4">
      <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
        {/* Left side: full-width search then status + sort controls */}
        <div className="flex-1 flex flex-col gap-3">
          {/* Inline search + controls */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-[220px] md:w-[240px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search workflows..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                className="pl-8 h-8 text-[11px]"
                aria-label="Search workflows"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowStatusFilters(v => !v)}
              aria-expanded={showStatusFilters}
              aria-controls="status-filters-panel"
              className="inline-flex items-center gap-2 h-8 rounded-md border border-border bg-background/70 hover:bg-background px-2 text-[11px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <span className="opacity-70">Statuses</span>
              {statusSet.size === 0 ? (
                <span className="text-muted-foreground">All</span>
              ) : (
                <div className="flex items-center gap-1">
                  {Array.from(statusSet).slice(0,3).map(s => (
                    <span key={s} className={`inline-flex items-center gap-1 px-1 py-0.5 rounded-full border ${statusMeta[s].bg} ${statusMeta[s].border} text-[10px] ${statusMeta[s].color}`}>{statusMeta[s].icon}</span>
                  ))}
                  {statusSet.size > 3 && <span className="text-[10px] text-muted-foreground">+{statusSet.size - 3}</span>}
                </div>
              )}
              <span className="ml-1 text-[10px] text-muted-foreground">{showStatusFilters ? 'Hide' : 'Show'}</span>
            </button>
            {statusSet.size > 0 && (
              <button
                type="button"
                onClick={() => setStatusSet(new Set())}
                className="inline-flex items-center gap-1 h-8 rounded-md px-2 text-[10px] font-medium border bg-background/60 hover:bg-background transition"
              >Clear</button>
            )}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-[10px] gap-2"
                onClick={() => setShowSortMenu(s => !s)}
                aria-haspopup="menu"
                aria-expanded={showSortMenu}
                title="Sort options"
              >
                <span className="opacity-70">Sort:</span>
                <span className="font-medium">
                  {sortBy === 'createdDate' ? 'Created Date'
                    : sortBy === 'updatedDate' ? 'Updated Date'
                    : sortBy === 'workflowName' ? 'Name'
                    : sortBy === 'status' ? 'Status'
                    : sortBy === 'creator' ? 'Creator'
                    : 'ID'}
                </span>
                <span className="opacity-70">({sortDir === 'asc' ? 'Asc' : 'Desc'})</span>
              </Button>
              {showSortMenu && (
                <div role="menu" className="absolute right-0 mt-2 w-44 rounded-md border border-border bg-popover text-popover-foreground shadow-md z-30 p-1 text-[10px]">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Sort Field</div>
                  {([
                    { key: 'createdDate', label: 'Created Date' },
                    { key: 'updatedDate', label: 'Updated Date' },
                    { key: 'workflowName', label: 'Name' },
                    { key: 'status', label: 'Status' },
                    { key: 'creator', label: 'Creator' },
                    { key: 'id', label: 'ID' },
                  ] as { key: SortField; label: string }[]).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => { setSortBy(opt.key); setShowSortMenu(false); setCurrentPage(1); }}
                      className={'w-full text-left px-2 py-0.5 rounded-md hover:bg-muted/40 text-[10px] ' + (sortBy === opt.key ? 'bg-muted/30 font-medium' : '')}
                      role="menuitem"
                    >
                      {opt.label}
                    </button>
                  ))}
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground mt-1">Direction</div>
                  <div className="mt-1 grid grid-cols-2 gap-1">
                    <button
                      onClick={() => { setSortDir('asc'); setShowSortMenu(false); }}
                      className={'px-2 py-0.5 rounded-md border text-[10px] ' + (sortDir === 'asc' ? 'bg-muted/60 font-semibold shadow-sm' : 'bg-background')}
                      role="menuitem"
                      aria-pressed={sortDir === 'asc'}
                    >Asc</button>
                    <button
                      onClick={() => { setSortDir('desc'); setShowSortMenu(false); }}
                      className={'px-2 py-0.5 rounded-md border text-[10px] ' + (sortDir === 'desc' ? 'bg-muted/60 font-semibold shadow-sm' : 'bg-background')}
                      role="menuitem"
                      aria-pressed={sortDir === 'desc'}
                    >Desc</button>
                  </div>
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              aria-label="Reset filters"
              className="h-8 px-2 text-[10px]"
              onClick={() => {
                setSearch('');
                setStatusSet(new Set());
                setSortBy('createdDate');
                setSortDir('desc');
                setCurrentPage(1);
                setViewMode('grid');
              }}
            >Reset</Button>
          </div>
          {showStatusFilters && (
            <div id="status-filters-panel" className="flex flex-wrap gap-1 max-h-28 overflow-y-auto pr-1">
              {(uiStatusOrder as WorkflowRecordUI['status'][]).map(s => {
                const meta = statusMeta[s];
                const active = statusSet.has(s);
                const count = grouped[s].length;
                return (
                  <button
                    key={s}
                    onClick={() => setStatusSet(prev => {
                      const next = new Set(prev);
                      if (next.has(s)) next.delete(s); else next.add(s);
                      return next;
                    })}
                    aria-pressed={active}
                    className={
                      'flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium border transition whitespace-nowrap ' +
                      (active ? `${meta.bg} ${meta.border} ${meta.color} shadow-sm` : 'bg-muted/40 text-muted-foreground hover:bg-muted')
                    }
                  >
                    {meta.icon}
                    <span>{meta.label}</span>
                    <span className="opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {/* Right side: view mode buttons constrained to two rows */}
        <div className="lg:w-64 xl:w-72 flex-shrink-0">
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Select view mode">
            {[
              { key: 'grid', label: 'Grid', icon: <LayoutGrid className="h-4 w-4" /> },
              { key: 'grouped', label: 'Grouped', icon: <Layers className="h-4 w-4" /> },
              { key: 'kanban', label: 'Kanban', icon: <KanbanSquare className="h-4 w-4" /> },
              { key: 'datatable', label: 'Table', icon: <Table className="h-4 w-4" /> },
              { key: 'hybrid', label: 'Hybrid', icon: <SplitSquareHorizontal className="h-4 w-4" /> },
              { key: 'activity', label: 'Activity', icon: <Activity className="h-4 w-4" /> },
              { key: 'analytics', label: 'Analytics', icon: <BarChart3 className="h-4 w-4" /> },
            ].map(m => (
              <button
                key={m.key}
                role="radio"
                aria-checked={viewMode === m.key}
                onClick={() => setViewMode(m.key as typeof viewMode)}
                className={
                  // Reverted size but horizontal layout
                  'flex items-center justify-center gap-1 h-8 rounded-md px-2 py-1 text-[8px] font-medium border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ' +
                  (viewMode === m.key
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-muted/50 hover:bg-muted text-foreground')
                }
              >
                {m.icon}
                <span className="leading-tight">{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div> 
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="truncate">Page {currentPage}/{totalPages} • {sorted.length} result{sorted.length === 1 ? '' : 's'} • View: {viewMode} • Sort: {sortBy} ({sortDir})</span>
        <span className="hidden sm:inline">Status Filters: {statusSet.size === 0 ? 'All' : statusSet.size}</span>
      </div>
    </div>
  </Card>

 
  <Card className="flex-1 flex flex-col border border-border/70 bg-card/90 backdrop-blur-sm shadow-sm">
        <div className="relative flex-1 overflow-auto rounded-md p-4">
          {viewMode === 'grid' ? (
            <WorkflowGridView
              items={paginated}
              loading={loading}
              onView={(id) => router.push(`/workflow/${id.replace('wf-','')}`)}
              onStart={handleStartWorkflow}
              onStop={handleCancelWorkflow}
              onDelete={(id) => { setDeleteTargetId(id); setShowDeleteConfirm(true); }}
              highlight={highlight}
            />
          ) : viewMode === 'kanban' ? (
            <WorkflowKanbanBoard
              items={paginated}
              loading={loading}
              statuses={["in-progress","draft","completed","expired","cancelled"]}
              onView={(id) => router.push(`/workflow/${id.replace('wf-','')}`)}
              onStatusChange={(id, status) => {
                setMutableData(data => data.map(w => w.id === id ? { ...w, status: status as WorkflowRecordUI['status'], updatedDate: new Date().toISOString() } : w));
              }}
              onDelete={(id) => { setDeleteTargetId(id); setShowDeleteConfirm(true); }}
              highlight={highlight}
            />
          ) : viewMode === 'datatable' ? (
            <WorkflowDataTable
              data={paginated}
              loading={loading}
              highlight={highlight}
              onView={(id) => router.push(`/workflow/${id.replace('wf-','')}`)}
              onStart={handleStartWorkflow}
              onStop={handleCancelWorkflow}
              onDelete={(id) => { setDeleteTargetId(id); setShowDeleteConfirm(true); }}
            />
          ) : viewMode === 'activity' ? (
            <WorkflowActivityFeed
              items={paginated}
              loading={loading}
              highlight={highlight}
              onView={(id) => router.push(`/workflow/${id.replace('wf-','')}`)}
              onStart={handleStartWorkflow}
              onStop={handleCancelWorkflow}
              onDelete={(id) => { setDeleteTargetId(id); setShowDeleteConfirm(true); }}
            />
          ) : viewMode === 'analytics' ? (
            <div className="space-y-8">
              {/* KPIs */}
              {(() => {
                const total = sorted.length || 1; // metrics based on full result set
                const counts = {
                  completed: sorted.filter(w => w.status === 'completed').length,
                  inProgress: sorted.filter(w => w.status === 'in-progress').length,
                  expired: sorted.filter(w => w.status === 'expired').length,
                  cancelled: sorted.filter(w => w.status === 'cancelled').length,
                  draft: sorted.filter(w => w.status === 'draft').length,
                  failed: sorted.filter(w => w.status === 'failed').length,
                };
                const turnaroundHours = sorted.reduce((acc, w) => acc + ((new Date(w.updatedDate).getTime() - new Date(w.createdDate).getTime()) / 3600000), 0);
                const avgTurnaround = total ? turnaroundHours / total : 0;
                const metrics = {
                  total: sorted.length,
                  completed: counts.completed,
                  inProgress: counts.inProgress,
                  expired: counts.expired,
                  failed: counts.failed,
                  cancelled: counts.cancelled,
                  draft: counts.draft,
                  avgTurnaroundHours: avgTurnaround,
                  completionRate: counts.completed / total,
                  failureRate: (counts.expired + counts.failed + counts.cancelled) / total,
                };
                return <StatusOverview metrics={metrics} />;
              })()}
              {/* Virtualized list */}
              <div className="space-y-4">
                <h2 className="text-sm font-semibold tracking-tight">Workflow List (Virtualized)</h2>
                <VirtualizedWorkflowList
                  items={paginated}
                  highlight={highlight}
                  onView={(id) => router.push(`/workflow/${id.replace('wf-','')}`)}
                  onUseTemplate={(wf) => {
                    // If templateId available use it, else fallback to templateName search or workflow id mapping.
                    const tid = (wf as any).templateId; // eslint-disable-line @typescript-eslint/no-explicit-any
                    if (tid) {
                      router.push(`/workflow/create?templateId=${tid}`);
                    } else if (wf.templateName && wf.templateName !== '-' ) {
                      router.push(`/workflow/create?fromTemplateName=${encodeURIComponent(wf.templateName)}`);
                    } else {
                      router.push(`/workflow/create?fromWorkflowId=${wf.id.replace('wf-','')}`);
                    }
                  }}
                  onStart={handleStartWorkflow}
                  onStop={handleCancelWorkflow}
                  onDelete={(id) => { setDeleteTargetId(id); setShowDeleteConfirm(true); }}
                  rowHeight={60}
                  overscan={6}
                />
              </div>
            </div>
          ) : viewMode === 'hybrid' ? (
            <div className="relative flex w-full h-full">
              <div className="flex-1 pr-4">
                <table className="w-full text-sm border border-border rounded-md overflow-hidden">
                  <thead className="bg-muted/50 text-xs">
                    <tr className="text-muted-foreground">
                      <th className="font-medium text-left px-3 py-2">Name</th>
                      <th className="font-medium text-left px-3 py-2">Template</th>
                      <th className="font-medium text-left px-3 py-2">Creator</th>
                      <th className="font-medium text-left px-3 py-2">Valid Until</th>
                      <th className="font-medium text-left px-3 py-2">Days Left</th>
                      <th className="font-medium text-left px-3 py-2">Status</th>
                      <th className="font-medium text-left px-3 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      [...Array(6)].map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          {[...Array(7)].map((__, j) => (
                            <td key={j} className="px-3 py-3"><div className="h-4 w-24 bg-muted rounded" /></td>
                          ))}
                        </tr>
                      ))
                    ) : paginated.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-16 text-center text-muted-foreground text-sm">No workflows found</td>
                      </tr>
                    ) : (
                      paginated.map(wf => (
                        <tr
                          key={wf.id}
                          onClick={() => setSelectedWorkflowId(id => id === wf.id ? null : wf.id)}
                          className={`group border-t border-border/60 hover:bg-muted/40 transition-colors cursor-pointer ${selectedWorkflowId === wf.id ? 'bg-primary/5' : ''}`}
                        >
                          <td className="px-3 py-2 font-medium">{highlight(wf.workflowName)}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{highlight(wf.templateName)}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground flex items-center gap-1"><User className="h-3.5 w-3.5" /> {highlight(wf.creator)} <SigningModeBadge className="ml-1" size="xs" isSequential={wf.isSequentialSigningEnabled} /></td>
                          <td className={"px-3 py-2 text-xs " + (wf.isExpired ? 'text-neutral-700 font-medium' : 'text-muted-foreground')}>{formatDateShort(wf.validUntil)}</td>
                          <td className={"px-3 py-2 text-xs " + (wf.isExpired ? 'text-neutral-700 font-semibold' : 'text-muted-foreground')}>{formatDaysRemaining(wf.daysRemaining)}</td>
                          <td className="px-3 py-2"><StatusBadge status={wf.status} /></td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              {wf.status === 'draft' && (
                                <Button
                                  size="sm"
                                  title="Start workflow"
                                  aria-label="Start workflow"
                                  className="h-7 px-2 text-[10px] gap-1 rounded-md bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-500 hover:to-blue-500 focus-visible:ring-2 focus-visible:ring-indigo-400/50"
                                  onClick={(e) => { e.stopPropagation(); handleStartWorkflow(wf.id); }}
                                >
                                  <Play className="h-3.5 w-3.5" /> Start
                                </Button>
                              )}
                              {wf.status === 'in-progress' && (
                                <div className="relative group">
                                  <Button
                                    size="sm"
                                    title="Cancel workflow (irreversible)"
                                    aria-label="Cancel workflow"
                                    className="h-7 px-2 text-[10px] gap-1 rounded-md bg-gradient-to-r from-rose-600 to-red-600 text-white hover:from-rose-500 hover:to-red-500 focus-visible:ring-2 focus-visible:ring-rose-400/50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm('Cancel this workflow? This action cannot be undone.')) {
                                        handleCancelWorkflow(wf.id);
                                      }
                                    }}
                                  >
                                    <Square className="h-3.5 w-3.5" /> Cancel
                                  </Button>
                                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition bg-popover text-popover-foreground border border-border rounded px-2 py-1 text-[10px] shadow-sm pointer-events-none">
                                    Irreversible
                                  </div>
                                </div>
                              )}
                              {/* Removed 'Use' per requirement; only lifecycle + view remain */}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs gap-1 hover:bg-primary/10 hover:text-primary"
                                onClick={(e) => { e.stopPropagation(); router.push(`/workflow/${wf.id.replace('wf-','')}`); }}
                              >
                                <Eye className="h-3.5 w-3.5" /> View
                              </Button>
                              {['draft','completed','cancelled'].includes(wf.status) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs gap-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                                  onClick={(e) => { e.stopPropagation(); setDeleteTargetId(wf.id); setShowDeleteConfirm(true); }}
                                  aria-label="Delete workflow"
                                  title="Delete workflow"
                                >
                                  Delete
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {/* Drawer Panel */}
              <div className="relative w-[380px] hidden xl:block">
                <div className={`absolute top-0 right-0 h-full w-[360px] border-l border-border bg-background/90 backdrop-blur shadow-lg transition-transform duration-300 flex flex-col ${selectedWorkflowId ? 'translate-x-0' : 'translate-x-full'}`}> 
                  {selectedWorkflowId ? (
                    (() => {
                      const wf = sorted.find(w => w.id === selectedWorkflowId);
                      if (!wf) return <div className="p-4 text-xs text-muted-foreground">Selection missing.</div>;
                      return (
                        <div className="flex flex-col h-full">
                          <div className="p-4 flex items-start justify-between border-b">
                            <div className="flex flex-col gap-1">
                              <h2 className="text-lg font-semibold leading-tight">{wf.workflowName}</h2>
                              <span className="text-[11px] font-mono text-muted-foreground">{wf.id}</span>
                            </div>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setSelectedWorkflowId(null)}>Close</Button>
                          </div>
                          <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
                            <div className="space-y-1">
                              <span className="text-muted-foreground">Status</span>
                              <div><StatusBadge status={wf.status} /></div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-muted-foreground">Valid Until</span>
                              <div className={wf.isExpired ? 'text-neutral-700 font-medium' : ''}>{formatDate(wf.validUntil)}{wf.isExpired ? ' • Expired' : ''}</div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-muted-foreground">Days Remaining</span>
                              <div className={wf.isExpired ? 'text-neutral-700 font-medium' : 'text-foreground'}>{formatDaysRemaining(wf.daysRemaining)}</div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-muted-foreground">Reminder Interval</span>
                              <div>{wf.reminderIntervalInDays} day(s)</div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-muted-foreground">Recipient Configuration</span>
                              <div className="font-mono text-[11px]">{wf.recipientConfiguration}</div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-muted-foreground">Template</span>
                              <div className="text-foreground text-sm">{wf.templateName}</div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-muted-foreground">Creator</span>
                              <div className="flex items-center gap-1 text-sm"><User className="h-3.5 w-3.5" /> {wf.creator} <SigningModeBadge className="ml-1" size="xs" isSequential={wf.isSequentialSigningEnabled} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <span className="text-muted-foreground">Created</span>
                                <div>{formatDate(wf.createdDate)}</div>
                              </div>
                              <div className="space-y-1">
                                <span className="text-muted-foreground">Updated</span>
                                <div>{formatDate(wf.updatedDate)}</div>
                              </div>
                              <div className="space-y-1">
                                <span className="text-muted-foreground">Valid Until</span>
                                <div className={wf.isExpired ? 'text-neutral-700 font-medium' : ''}>{formatDate(wf.validUntil)}{wf.isExpired ? ' • Expired' : ''}</div>
                              </div>
                              <div className="space-y-1">
                                <span className="text-muted-foreground">Days Remaining</span>
                                <div className={wf.isExpired ? 'text-neutral-700 font-medium' : 'text-foreground'}>{formatDaysRemaining(wf.daysRemaining)}</div>
                              </div>
                              <div className="space-y-1">
                                <span className="text-muted-foreground">Reminder Interval</span>
                                <div>{wf.reminderIntervalInDays} day(s)</div>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-muted-foreground">Recipient Configuration</span>
                              <div className="font-mono text-[11px]">{wf.recipientConfiguration}</div>
                            </div>
                            <Separator />
                            <div className="space-y-2">
                              <span className="text-muted-foreground">Quick Actions</span>
                              <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => router.push(`/workflow/${wf.id.replace('wf-','')}`)}>Open Full View</Button>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs">Duplicate</Button>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs">Archive</Button>
                              </div>
                            </div>
                          </div>
                          <div className="p-3 text-[10px] text-muted-foreground border-t">Hybrid Drawer • Click a different row to update • Esc/Close to dismiss</div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="p-4 text-xs text-muted-foreground flex items-center justify-center h-full">Select a workflow row to view details</div>
                  )}
                </div>
              </div>
              {/* Mobile overlay panel */}
              {selectedWorkflowId && (
                <div className="xl:hidden fixed inset-0 z-50 flex">
                  <div className="flex-1 bg-black/40" onClick={() => setSelectedWorkflowId(null)} />
                  <div className="w-[80%] max-w-[400px] bg-background border-l border-border shadow-xl flex flex-col">
                    {(() => {
                      const wf = sorted.find(w => w.id === selectedWorkflowId);
                      if (!wf) return <div className="p-4 text-xs">Missing selection.</div>;
                      return (
                        <div className="flex flex-col h-full">
                          <div className="p-4 flex items-start justify-between border-b">
                            <div className="flex flex-col gap-1">
                              <h2 className="text-base font-semibold leading-tight">{wf.workflowName}</h2>
                              <span className="text-[11px] font-mono text-muted-foreground">{wf.id}</span>
                            </div>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setSelectedWorkflowId(null)}>Close</Button>
                          </div>
                          <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
                            <div className="space-y-1">
                              <span className="text-muted-foreground">Status</span>
                              <div><StatusBadge status={wf.status} /></div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-muted-foreground">Template</span>
                              <div className="text-foreground text-sm">{wf.templateName}</div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-muted-foreground">Creator</span>
                              <div className="flex items-center gap-1 text-sm"><User className="h-3.5 w-3.5" /> {wf.creator} <SigningModeBadge className="ml-1" size="xs" isSequential={wf.isSequentialSigningEnabled} /></div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <span className="text-muted-foreground">Created</span>
                                <div>{formatDate(wf.createdDate)}</div>
                              </div>
                              <div className="space-y-1">
                                <span className="text-muted-foreground">Updated</span>
                                <div>{formatDate(wf.updatedDate)}</div>
                              </div>
                            </div>
                            <Separator />
                            <div className="space-y-2">
                              <span className="text-muted-foreground">Quick Actions</span>
                              <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => router.push(`/workflow/${wf.id.replace('wf-','')}`)}>Open Full View</Button>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs">Duplicate</Button>
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs">Archive</Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {loading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-24 rounded-md border border-border bg-muted/40 animate-pulse" />
                  ))}
                </div>
              ) : sorted.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
                  <FileText className="h-10 w-10 opacity-40" />
                  <span>No workflows found</span>
                </div>
              ) : (
                (uiStatusOrder as WorkflowRecordUI['status'][]).map(status => {
                  const items = grouped[status];
                  if (items.length === 0) return null;
                  const meta = statusMeta[status];
                  return (
                    <div key={status} className="space-y-3">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-md border text-sm font-semibold ${meta.bg} ${meta.border} ${meta.color}`}>{meta.icon}{meta.label}</span>
                        <span className="text-xs text-muted-foreground">({items.length})</span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {items.slice((currentPage-1)*pageSize, (currentPage-1)*pageSize + pageSize).map(wf => (
                          <div key={wf.id} className="p-3 rounded-md border border-border bg-background/60 hover:bg-muted/40 transition flex flex-col gap-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm line-clamp-2">{highlight(wf.workflowName)}</span>
                              <StatusBadge status={wf.status} />
                            </div>
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>Created: {formatDateShort(wf.createdDate)}</span>
                              {wf.createdDate !== wf.updatedDate && (
                                <span>Updated: {formatDateShort(wf.updatedDate)}</span>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground">Template: {highlight(wf.templateName)}</div>
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" />
                              Creator: {highlight(wf.creator)}
                              <SigningModeBadge className="ml-1" size="xs" isSequential={wf.isSequentialSigningEnabled} />
                            </div>
                            {wf.validUntil && (
                              <div className={`text-[10px] ${wf.isExpired ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                                Due: {formatDateShort(wf.validUntil)}{wf.isExpired ? ' • Expired' : ''}
                              </div>
                            )}
                            {wf.daysRemaining !== undefined && (
                              <div className={`text-[10px] ${wf.isExpired ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                                {formatDaysRemaining(wf.daysRemaining)}
                              </div>
                            )}
                            <div className="flex items-center justify-center gap-2 pt-1">
                              {wf.status === 'draft' && (
                                <Button
                                  size="sm"
                                  title="Start workflow"
                                  aria-label="Start workflow"
                                  className="h-7 px-2 text-[10px] gap-1 rounded-md bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-500 hover:to-blue-500 focus-visible:ring-2 focus-visible:ring-indigo-400/50"
                                  onClick={() => handleStartWorkflow(wf.id)}
                                >
                                  <Play className="h-3.5 w-3.5" /> Start
                                </Button>
                              )}
                              {wf.status === 'in-progress' && (
                                <Button
                                  size="sm"
                                  title="Cancel workflow (irreversible)"
                                  aria-label="Cancel workflow"
                                  className="h-7 px-2 text-[10px] gap-1 rounded-md bg-gradient-to-r from-rose-600 to-red-600 text-white hover:from-rose-500 hover:to-red-500 focus-visible:ring-2 focus-visible:ring-rose-400/50"
                                  onClick={() => {
                                    if (confirm('Cancel this workflow? This action cannot be undone.')) {
                                      handleCancelWorkflow(wf.id);
                                    }
                                  }}
                                >
                                  <Square className="h-3.5 w-3.5" /> Cancel
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs gap-1 hover:bg-primary/10 hover:text-primary"
                                aria-label="View workflow"
                                title="View workflow"
                                onClick={() => router.push(`/workflow/${wf.id.replace('wf-','')}`)}
                              >
                                <Eye className="h-3.5 w-3.5" /> View
                              </Button>
                              {['draft','completed','cancelled'].includes(wf.status) && (
                                <button
                                  type="button"
                                  aria-label="Delete workflow"
                                  title="Delete workflow"
                                  onClick={() => { setDeleteTargetId(wf.id); setShowDeleteConfirm(true); }}
                                  className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border/60 bg-background/70 hover:bg-red-50 dark:hover:bg-red-900/40 hover:text-red-600 transition"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
        <Separator />
        <div className="px-4 py-3 bg-muted/30 text-xs text-muted-foreground flex items-center justify-between gap-4 flex-wrap">
          <span>{totalCount} workflow{totalCount === 1 ? '' : 's'} • Page {currentPage}/{totalPages} • Page Size {pageSize} • View: {viewMode} • Selected: {selectedWorkflowId ?? 'none'} • Sorted By: {getSortFieldLabel(sortBy)} ({sortDir}){error ? ` • Error: ${error}` : ''}</span>
          <div className="flex items-center gap-2">
            <span>Sort: {getSortFieldLabel(sortBy)} ({sortDir}) • Status Chips: {statusSet.size || 'none'}</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-6 px-2" disabled={currentPage===1} onClick={() => goToPage(currentPage-1)}>Prev</Button>
              <Button variant="outline" size="sm" className="h-6 px-2" disabled={currentPage===totalPages} onClick={() => goToPage(currentPage+1)}>Next</Button>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="h-6 text-[10px] px-1 rounded border border-border bg-background"
              >
                {[10,25,50].map(sz => <option key={sz} value={sz}>{sz}/page</option>)}
              </select>
            </div>
          </div>
        </div>
      </Card>
      {showDeleteConfirm && deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { if (!isDeleting) { setShowDeleteConfirm(false); setDeleteTargetId(null); } }} />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-sm rounded-lg border border-border bg-background shadow-lg p-5 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div className="flex-1">
                <h2 className="text-base font-semibold">Delete Workflow</h2>
                <p className="text-xs text-muted-foreground mt-1">This will permanently remove the workflow and associated records. This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-2">
              <Button variant="outline" size="sm" disabled={isDeleting} onClick={() => { setShowDeleteConfirm(false); setDeleteTargetId(null); }}>Cancel</Button>
              <Button size="sm" disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white" onClick={async () => {
                if (!deleteTargetId) return; setIsDeleting(true);
                const numericId = Number(deleteTargetId.replace('wf-',''));
                const prev = mutableData;
                try {
                  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
                  if (!token) throw new Error('Missing auth token');
                  const resp = await fetch(`${apiRoot}/workflow/delete?workflowId=${numericId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                  if (!resp.ok) throw new Error('Delete failed');
                  const json = await resp.json();
                  if (json.status !== 'success') throw new Error(json.message || 'Delete failed');
                  setMutableData(data => data.filter(w => w.id !== deleteTargetId));
                  toast.success('Workflow deleted');
                } catch (e:any) {
                  toast.error(e.message || 'Failed to delete workflow');
                  setMutableData(prev); // rollback if we had altered
                } finally {
                  setIsDeleting(false);
                  setShowDeleteConfirm(false);
                  setDeleteTargetId(null);
                }
              }}>{isDeleting ? 'Deleting...' : 'Delete'}</Button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default WorkflowListPage;
