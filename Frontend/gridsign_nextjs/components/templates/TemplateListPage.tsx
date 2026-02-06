"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { formatDateDDMMYYYY } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useRouter } from 'next/navigation';
import {
  Search,
  LayoutGrid,
  Layers,
  KanbanSquare,
  Table,
  SplitSquareHorizontal,
  Activity,
  BarChart3,
  Eye,
  FileText,
  FilePlus,
  ChevronRight,
  Trash2,
  AlertTriangle,
  User
} from 'lucide-react';
import SendForSignaturePage from '@/components/send-for-signature/SendForSignaturePage';
import { useTemplateActions } from '@/hooks/useTemplateActions';
import TemplateGridView, { TemplateGridItem } from './TemplateGridView';
import { useApiQuery } from '@/hooks/useApiQuery';
import { toast } from 'sonner';
import { TemplatesPagedRaw, TemplateResponseRaw, mapTemplateRawToUI } from '@/types/template';

// Backend enumerations currently provide Active / Draft; keep Deprecated as fallback if surfaced.
type TemplateStatusUI = 'active' | 'draft' | 'deprecated';
interface TemplateRecord extends Omit<TemplateGridItem, 'status'> { status: TemplateStatusUI }
const statusMeta: Record<TemplateStatusUI, { label: string; color: string; bg: string; border: string; icon?: React.ReactNode }> = {
  active: { label: 'Active', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', icon: <span className="w-2 h-2 rounded-full bg-green-500" /> },
  draft: { label: 'Draft', color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-200', icon: <span className="w-2 h-2 rounded-full bg-gray-400" /> },
  deprecated: { label: 'Deprecated', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', icon: <span className="w-2 h-2 rounded-full bg-red-500" /> },
};

const StatusBadge: React.FC<{ status: TemplateRecord['status'] }> = ({ status }) => {
  const meta = statusMeta[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${meta.bg} ${meta.color} ${meta.border}`}>
      {meta.icon}
      {meta.label}
    </span>
  );
};

const TemplateListPage: React.FC = () => {
  const router = useRouter();
  const [loadedPrefs, setLoadedPrefs] = useState(false);
  const [search, setSearch] = useState('');
  const [statusSet, setStatusSet] = useState<Set<TemplateStatusUI>>(new Set());
  type SortField = 'name' | 'owner' | 'createdOn' | 'updatedDate' | 'status' | 'usageCount' | 'templateId';
  const [sortBy, setSortBy] = useState<SortField>('createdOn');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [signingModeFilter, setSigningModeFilter] = useState<number>(0); // 0=All,1=Sequential,2=Parallel
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'grouped' | 'kanban' | 'datatable' | 'hybrid' | 'activity' | 'analytics'>('grid');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [mutableData, setMutableData] = useState<TemplateRecord[]>([]);
  const [showStatusFilters, setShowStatusFilters] = useState<boolean>(true);
  // Deletion state & modals
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [blockedDeleteInfo, setBlockedDeleteInfo] = useState<{ workflowCount: number; workflows: { workflowId: number; workflowName: string | null; status: string }[] } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Server pagination parity
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Load saved preferences (view, filters, sort, search) on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('gridsignPrefs');
      if (raw) {
        const prefs = JSON.parse(raw);
        const allowedViews = ['grid','grouped','kanban','datatable','hybrid','activity','analytics'];
        if (prefs.templateViewMode && allowedViews.includes(prefs.templateViewMode)) setViewMode(prefs.templateViewMode);
        if (prefs.sortTemplate && prefs.sortTemplate.field) {
          const fld = prefs.sortTemplate.field as SortField;
          if (['name','owner','createdOn','updatedDate','status','usageCount','templateId'].includes(fld)) {
            setSortBy(fld);
            if (prefs.sortTemplate.dir === 'asc' || prefs.sortTemplate.dir === 'desc') setSortDir(prefs.sortTemplate.dir);
          }
        }
        if (typeof prefs.searchTemplate === 'string') setSearch(prefs.searchTemplate);
        if (Array.isArray(prefs.templateStatusFilters) && prefs.templateStatusFilters.length) {
          const validStatuses = prefs.templateStatusFilters.filter((s: TemplateStatusUI) => ['active','draft','deprecated'].includes(s));
          setStatusSet(new Set(validStatuses));
        }
      }
    } catch {}
    setLoadedPrefs(true);
  }, []);

  // Baseline preference initialization (templates) after load to avoid overwrite
  useEffect(() => {
    if (!loadedPrefs) return;
    try {
      const raw = localStorage.getItem('gridsignPrefs');
      const prefs = raw ? JSON.parse(raw) : {};
      if (!prefs.templateViewMode) prefs.templateViewMode = viewMode;
      if (!prefs.templateStatusFilters) prefs.templateStatusFilters = Array.from(statusSet);
      if (!prefs.sortTemplate) prefs.sortTemplate = { field: sortBy, dir: sortDir };
      if (!prefs.searchTemplate) prefs.searchTemplate = search;
      prefs.lastPage = '/templates';
      prefs.updatedAt = new Date().toISOString();
      localStorage.setItem('gridsignPrefs', JSON.stringify(prefs));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedPrefs]);

  // Persist template preference changes continually
  useEffect(() => {
    if (!loadedPrefs) return; // wait until preferences loaded to avoid premature overwrite
    try {
      const raw = localStorage.getItem('gridsignPrefs');
      const prefs = raw ? JSON.parse(raw) : {};
      prefs.templateViewMode = viewMode;
      prefs.templateStatusFilters = Array.from(statusSet);
      prefs.sortTemplate = { field: sortBy, dir: sortDir };
      prefs.searchTemplate = search;
      prefs.lastPage = '/templates';
      prefs.updatedAt = new Date().toISOString();
      localStorage.setItem('gridsignPrefs', JSON.stringify(prefs));
      window.dispatchEvent(new StorageEvent('storage', { key: 'gridsignPrefs', newValue: JSON.stringify(prefs) }));
    } catch {}
  }, [loadedPrefs, viewMode, statusSet, sortBy, sortDir, search, currentPage, pageSize]);

  // Build API root
  const baseUrl = process.env.NEXT_PUBLIC_LOCAL_API_URL || 'http://localhost:3000';
  const trimmedBase = baseUrl.endsWith('/') ? baseUrl.slice(0,-1) : baseUrl;
  const apiRoot = /\/api$/i.test(trimmedBase) ? trimmedBase : `${trimmedBase}/api`;

  const backendSortKey = (field: SortField): string => {
    switch (field) {
      case 'name': return 'Name';
      case 'owner': return 'Owner';
      case 'createdOn': return 'CreatedOn';
      case 'updatedDate': return 'LastUpdatedDate';
      case 'status': return 'Status';
      case 'usageCount': return 'UsageCount';
      case 'templateId': return 'TemplateId';
      default: return 'Name';
    }
  };

  const getSortFieldLabel = (f: SortField): string => {
    switch (f) {
      case 'name': return 'Name';
      case 'owner': return 'Owner';
      case 'createdOn': return 'Created';
      case 'updatedDate': return 'Updated';
      case 'status': return 'Status';
      case 'usageCount': return 'Usage';
      case 'templateId': return 'ID';
      default: return f;
    }
  };

  const uiTemplateStatusToBackend = (s: TemplateStatusUI): number | null => {
    if (s === 'draft') return 0;
    if (s === 'active') return 1;
    return null; // deprecated not mapped
  };
  const backendStatusesArray = useMemo(() => {
    if (statusSet.size === 0) return [] as number[];
    return Array.from(statusSet).map(uiTemplateStatusToBackend).filter((n): n is number => n !== null);
  }, [statusSet]);

  const requestHeaders = useMemo(() => ({
    PageNumber: currentPage,
    PageSize: pageSize,
    SearchTerm: search || undefined,
    SortBy: backendSortKey(sortBy),
    IsDescending: sortDir === 'desc',
    Statuses: backendStatusesArray.length ? backendStatusesArray.join(',') : undefined,
  }), [currentPage, pageSize, search, sortBy, sortDir, backendStatusesArray]);

  // Defer initial fetch until preferences loaded to prevent double request (default state -> hydrated prefs)
  const templatesQuery = useApiQuery<{ items: TemplateRecord[]; totalCount: number; pageNumber: number; pageSize: number; }>({
    queryKey: ['templates', currentPage, pageSize, search, sortBy, sortDir, signingModeFilter, startDate, endDate, backendStatusesArray.sort().join('-')],
    method: 'POST',
    url: `${apiRoot}/template/getAllTemplates`,
    body: {
      PageNumber: currentPage,
      PageSize: pageSize,
      SearchTerm: search || '',
      SortBy: backendSortKey(sortBy),
      IsDescending: sortDir === 'desc',
      SigningModeFilter: signingModeFilter,
      StartDate: startDate || null,
      EndDate: endDate || null,
      Statuses: backendStatusesArray.length ? backendStatusesArray : null,
    },
    config: {
      headers: Object.fromEntries(Object.entries(requestHeaders).filter(([,v]) => v !== undefined).map(([k,v]) => [k,String(v)])),
    },
  staleTime: 10_000,
  enabled: loadedPrefs, // only run once preferences have hydrated
    transform: (raw: TemplatesPagedRaw) => {
      const rawValues: TemplateResponseRaw[] = raw?.items?.$values ?? [];
      return {
        items: rawValues.map(r => {
          const mapped = mapTemplateRawToUI(r);
          return {
            id: mapped.id,
            templateName: mapped.name,
            category: '-',
            owner: mapped.owner,
            status: mapped.status as TemplateStatusUI,
            createdDate: mapped.createdDate,
            updatedDate: mapped.createdDate,
            usageCount: mapped.usageCount,
            isSequentialSigning: mapped.isSequentialSigning,
          } as TemplateRecord;
        }),
        totalCount: raw.totalCount ?? rawValues.length,
        pageNumber: raw.pageNumber ?? currentPage,
        pageSize: raw.pageSize ?? pageSize,
      };
    },
  });

  const loading = templatesQuery.isLoading;
  const apiData = templatesQuery.data?.data;

  useEffect(() => {
    const err = templatesQuery.error;
    if (err) {
      const statusCode = (err as any)?.response?.status; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (statusCode === 401) {
        toast.error('Session Expired');
        setTimeout(() => { if (typeof window !== 'undefined') window.location.href = '/signin'; }, 1000);
      } else {
        toast.error(err.message || 'Failed to load templates');
      }
    } else if (apiData) {
      setMutableData(apiData.items);
    }
  }, [templatesQuery.error, apiData]);

  // NOTE: Removed eager owner enrichment that triggered getTemplateDetails for each template.
  // Owner values will remain as returned by getAllTemplates to avoid N+1 API calls.
  // If enrichment is needed later, fetch will occur only in explicit detail or use-template contexts.

  const filtered = useMemo(() => {
    const lower = search.toLowerCase();
    return mutableData.filter(t => {
      const matchesSearch = !lower || [t.templateName, t.owner, t.status].some(v => v.toLowerCase().includes(lower));
      const matchesStatus = statusSet.size === 0 || statusSet.has(t.status);
      return matchesSearch && matchesStatus;
    });
  }, [search, statusSet, mutableData]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a,b) => {
      switch (sortBy) {
        case 'status': {
          const order: TemplateStatusUI[] = ['active','draft','deprecated'];
          const ai = order.indexOf(a.status); const bi = order.indexOf(b.status);
          return sortDir === 'asc' ? ai - bi : bi - ai;
        }
        case 'usageCount': return sortDir === 'asc' ? a.usageCount - b.usageCount : b.usageCount - a.usageCount;
        case 'name': { const av = a.templateName.localeCompare(b.templateName); return sortDir === 'asc' ? av : -av; }
        case 'owner': { const av = a.owner.localeCompare(b.owner); return sortDir === 'asc' ? av : -av; }
        case 'templateId': { const av = a.id.localeCompare(b.id); return sortDir === 'asc' ? av : -av; }
        case 'createdOn': { const av = new Date(a.createdDate).getTime(); const bv = new Date(b.createdDate).getTime(); return sortDir === 'asc' ? av - bv : bv - av; }
        case 'updatedDate': { const av = new Date(a.updatedDate).getTime(); const bv = new Date(b.updatedDate).getTime(); return sortDir === 'asc' ? av - bv : bv - av; }
        default: return 0;
      }
    });
    return arr;
  }, [filtered, sortBy, sortDir]);

  // Pagination (local slice of already fetched server page)
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);
  const goToPage = (p: number) => setCurrentPage(Math.min(Math.max(1, p), totalPages));

  const grouped = useMemo(() => {
    const groups: Record<TemplateStatusUI, TemplateRecord[]> = { active: [], draft: [], deprecated: [] };
    for (const t of sorted) groups[t.status].push(t);
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

  const [showCreateInline, setShowCreateInline] = useState(false);
  const [embeddedTemplateId, setEmbeddedTemplateId] = useState<string | null>(null);
  const { deleteTemplate } = useTemplateActions();
  // Auto-open inline create if redirected from /templates/create
  useEffect(() => {
    try {
      const flag = localStorage.getItem('openInlineTemplateCreate');
      if (flag === '1') {
        setShowCreateInline(true);
        localStorage.removeItem('openInlineTemplateCreate');
      }
    } catch {}
  }, []);

  return (
    <div className="w-full h-full flex flex-col gap-6 p-6">
      {showCreateInline ? (
        <div className="flex flex-col gap-4">
          <nav aria-label="Breadcrumb" className="text-[11px] flex items-center gap-1 text-muted-foreground">
            <button type="button" onClick={() => setShowCreateInline(false)} className="hover:underline">Templates</button>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">New Template</span>
          </nav>
          <div className="rounded-lg border border-border bg-card/80 backdrop-blur-sm shadow-sm p-2">
            <SendForSignaturePage modeOverride="template" onCancelEmbed={() => setShowCreateInline(false)} />
          </div>
        </div>
      ) : embeddedTemplateId ? (
        <div className="flex flex-col gap-4">
          <nav aria-label="Breadcrumb" className="text-[11px] flex items-center gap-1 text-muted-foreground">
            <button type="button" onClick={() => setEmbeddedTemplateId(null)} className="hover:underline">Templates</button>
            <ChevronRight className="h-3 w-3" />
            <span className="text-foreground font-medium">Use Template</span>
          </nav>
          <div className="rounded-lg border border-border bg-card/80 backdrop-blur-sm shadow-sm p-2">
            <SendForSignaturePage modeOverride="use-template" templateId={embeddedTemplateId} onCancelEmbed={() => setEmbeddedTemplateId(null)} />
          </div>
        </div>
      ) : (
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Templates</h1>
          <p className="text-xs text-muted-foreground">Browse and use templates to create new workflows</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="h-8 px-3 text-[11px] font-medium tracking-tight whitespace-nowrap inline-flex items-center gap-1 bg-background border border-border hover:bg-yellow-100 hover:border-yellow-300 dark:hover:bg-yellow-300/20 dark:hover:border-yellow-400/40 text-foreground shadow-sm focus-visible:ring-2 focus-visible:ring-yellow-300/60 dark:focus-visible:ring-yellow-400/50 transition-colors"
            aria-label="Create a new template"
            onClick={() => setShowCreateInline(true)}
          >
            <FilePlus className="h-3.5 w-3.5" />
            New Template
          </Button>
        </div>
      </div>
      )}
  {!showCreateInline && !embeddedTemplateId && (
  <Card className="sticky top-0 z-20 border border-border/70 bg-card/90 backdrop-blur px-4 py-4 flex flex-col gap-4 shadow-sm rounded-lg">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
            {/* Left side controls (search, filters, sort) */}
            <div className="flex-1 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-[220px] md:w-[240px]">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search templates..."
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                    className="pl-8 h-8 text-[11px]"
                    aria-label="Search templates"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <select
                    aria-label="Sort field"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortField)}
                    className="h-8 rounded-md border border-border bg-background px-2 text-[10px] focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value="name">Name</option>
                    <option value="owner">Owner</option>
                    <option value="createdOn">Created</option>
                    <option value="updatedDate">Updated</option>
                    <option value="status">Status</option>
                    <option value="usageCount">Usage</option>
                    <option value="templateId">ID</option>
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label="Toggle sort direction"
                    className="h-8 px-2 text-[10px]"
                    onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                  >{sortDir === 'asc' ? 'Asc' : 'Desc'}</Button>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Signing mode filter"
                    value={signingModeFilter}
                    onChange={(e) => setSigningModeFilter(Number(e.target.value))}
                    className="h-8 rounded-md border border-border bg-background px-2 text-[10px] focus:outline-none focus:ring-2 focus:ring-primary/40"
                  >
                    <option value={0}>All Modes</option>
                    <option value={1}>Sequential Only</option>
                    <option value={2}>Parallel Only</option>
                  </select>
                  {/* Consolidated date range selector */}
                  <div className="flex items-center gap-1 h-8 rounded-md border border-border bg-background px-2 text-[10px] focus-within:ring-2 focus-within:ring-primary/40">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => { setStartDate(e.target.value); if (!endDate) setEndDate(e.target.value); }}
                      aria-label="Start date"
                      className="h-6 rounded bg-transparent"
                    />
                    <span className="text-[10px] text-muted-foreground">→</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      aria-label="End date"
                      className="h-6 rounded bg-transparent"
                      min={startDate || undefined}
                    />
                    {(startDate || endDate) && (
                      <button
                        type="button"
                        aria-label="Clear date range"
                        onClick={() => { setStartDate(''); setEndDate(''); }}
                        className="ml-1 inline-flex items-center px-1 py-0.5 text-[9px] rounded border bg-muted hover:bg-muted/70 text-muted-foreground"
                      >Clear</button>
                    )}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label="Reset filters"
                  className="h-8 px-2 text-[10px]"
                  onClick={() => {
                    setSearch('');
                    setStatusSet(new Set());
                    setSortBy('createdOn');
                    setSortDir('desc');
                    setSigningModeFilter(0);
                    setStartDate('');
                    setEndDate('');
                    setCurrentPage(1);
                    setViewMode('grid');
                  }}
                >Reset</Button>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setShowStatusFilters(v => !v)}
                    aria-expanded={showStatusFilters}
                    aria-controls="template-status-filters-inline"
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
                  {showStatusFilters && (
                    <div id="template-status-filters-inline" className="flex flex-wrap gap-1 max-w-[420px] overflow-hidden">
                      {(['active','draft','deprecated'] as TemplateRecord['status'][]).map(s => {
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
                            className={'flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-medium border transition whitespace-nowrap ' + (active ? `${meta.bg} ${meta.border} ${meta.color} shadow-sm` : 'bg-muted/40 text-muted-foreground hover:bg-muted')}
                          >
                            {meta.icon}
                            <span>{meta.label}</span>
                            <span className="opacity-70">({count})</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {statusSet.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setStatusSet(new Set())}
                      className="inline-flex items-center gap-1 h-8 rounded-md px-2 text-[10px] font-medium border bg-background/60 hover:bg-background transition"
                    >Clear</button>
                  )}
                </div>
              </div>
              {/* Status filters now inline to the right of the toggle; panel removed */}
            </div>
            {/* Right side: view mode buttons */}
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
                    className={'flex items-center justify-center gap-1 h-8 rounded-md px-2 py-1 text-[8px] font-medium border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ' + (viewMode === m.key ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-muted/50 hover:bg-muted text-foreground')}
                  >
                    {m.icon}
                    <span className="leading-tight">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground flex-wrap">
            <span className="truncate">Page {currentPage}/{totalPages} • {totalCount} template{totalCount === 1 ? '' : 's'} • View: {viewMode} • Sort: {getSortFieldLabel(sortBy)} ({sortDir}) • Mode: {signingModeFilter}</span>
            <span className="">Status: {statusSet.size === 0 ? 'All' : statusSet.size} • Dates: {startDate || endDate ? `${startDate || '—'} → ${endDate || '—'}` : 'None'}</span>
          </div>
        </div>
  </Card>
  )}

  {!showCreateInline && !embeddedTemplateId && (
  <Card className="flex-1 flex flex-col border border-border/70 bg-card/90 backdrop-blur-sm shadow-sm">
        <div className="relative flex-1 overflow-auto rounded-md p-4">
          {viewMode === 'grid' ? (
            <TemplateGridView
              items={paginated}
              loading={loading}
              onUse={(id) => setEmbeddedTemplateId(id)}
              onView={(id) => router.push(`/template-details/${id}`)}
              onDelete={(id) => {
                const tpl = mutableData.find(t => t.id === id);
                if (!tpl) return;
                if (tpl.status !== 'draft' || tpl.usageCount !== 0) return; // Guard condition
                setDeleteTargetId(id);
                setShowDeleteConfirm(true);
              }}
              highlight={highlight}
            />
          ) : viewMode === 'grouped' ? (
            <div className="space-y-8">
              {(['active','draft'] as TemplateStatusUI[]).map(status => {
                const items = grouped[status];
                if (!items.length) return null;
                const meta = statusMeta[status];
                return (
                  <div key={status} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-2 px-2 py-1 rounded-md border text-sm font-semibold ${meta.bg} ${meta.border} ${meta.color}`}>{meta.icon}{meta.label}</span>
                      <span className="text-xs text-muted-foreground">({items.length})</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {items.slice((currentPage-1)*pageSize,(currentPage-1)*pageSize+pageSize).map(t => (
                        <div key={t.id} className="p-3 rounded-md border border-border bg-background/60 hover:bg-muted/40 transition flex flex-col gap-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm line-clamp-2">{highlight(t.templateName)}</span>
                            <StatusBadge status={t.status} />
                          </div>
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>Created: {formatDateDDMMYYYY(t.createdDate)}</span>
                            {t.createdDate !== t.updatedDate && (
                              <span>Updated: {formatDateDDMMYYYY(t.updatedDate)}</span>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground">Owner: {highlight(t.owner)}</div>
                          <div className="text-[10px] text-muted-foreground">Mode: {t.isSequentialSigning ? 'Sequential' : 'Parallel'}</div>
                          <div className="text-[10px] text-muted-foreground">Used {t.usageCount} time{t.usageCount===1?'':'s'}</div>
                          <div className="flex items-center justify-center gap-3 pt-1">
                            <Button size="sm" className="use-template-btn" aria-label="Use template" onClick={() => setEmbeddedTemplateId(t.id)}>Use Template</Button>
                            <Button size="sm" className="brand-gradient-btn h-7 px-2 text-[10px] font-medium tracking-tight whitespace-nowrap" aria-label="View template" onClick={() => router.push(`/template-details/${t.id}`)}>View Template</Button>
                            {t.status === 'draft' && t.usageCount === 0 && (
                              <button
                                type="button"
                                aria-label="Delete template"
                                title="Delete draft template"
                                onClick={() => { setDeleteTargetId(t.id); setShowDeleteConfirm(true); }}
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
              })}
            </div>
          ) : viewMode === 'datatable' ? (
            <table className="w-full text-sm border border-border rounded-md overflow-hidden">
              <thead className="bg-muted/50 text-xs">
                <tr className="text-muted-foreground">
                  <th className="text-left font-medium px-3 py-2">Name</th>
                  {/* Category column removed */}
                  <th className="text-left font-medium px-3 py-2">Owner</th>
                  <th className="text-left font-medium px-3 py-2">Status</th>
                  <th className="text-left font-medium px-3 py-2">Created</th>
                  <th className="text-left font-medium px-3 py-2">Updated</th>
                  <th className="text-left font-medium px-3 py-2">Usage</th>
                  <th className="text-left font-medium px-3 py-2">Mode</th>
                  <th className="text-left font-medium px-3 py-2">Action</th>
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
                    <td colSpan={7} className="py-16 text-center text-muted-foreground text-sm">No templates found</td>
                  </tr>
                ) : (
                  paginated.map(t => (
                    <tr key={t.id} className="group border-t border-border/60 hover:bg-muted/40 transition-colors">
                      <td className="px-3 py-2 font-medium text-sm">{highlight(t.templateName)}</td>
                      {/* Category cell removed */}
                      <td className="px-3 py-2 text-xs text-muted-foreground">{highlight(t.owner)}</td>
                      <td className="px-3 py-2"><StatusBadge status={t.status} /></td>
                      <td className="px-3 py-2 text-[11px] text-muted-foreground">{formatDateDDMMYYYY(t.createdDate)}</td>
                      <td className="px-3 py-2 text-[11px] text-muted-foreground">{formatDateDDMMYYYY(t.updatedDate)}</td>
                      <td className="px-3 py-2 text-[11px] text-muted-foreground">{t.usageCount}</td>
                      <td className="px-3 py-2 text-[11px] text-muted-foreground">{t.isSequentialSigning ? 'Sequential' : 'Parallel'}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-3 pt-1">
                          <Button size="sm" className="use-template-btn" aria-label="Use template" onClick={() => setEmbeddedTemplateId(t.id)}>Use Template</Button>
                          <Button size="sm" className="brand-gradient-btn h-7 px-2 text-[10px] font-medium tracking-tight whitespace-nowrap" aria-label="View template" onClick={() => router.push(`/template-details/${t.id}`)}>View Template</Button>
                          {t.status === 'draft' && t.usageCount === 0 && (
                            <button
                              type="button"
                              aria-label="Delete template"
                              title="Delete draft template"
                              onClick={() => { setDeleteTargetId(t.id); setShowDeleteConfirm(true); }}
                              className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border/60 bg-background/70 hover:bg-red-50 dark:hover:bg-red-900/40 hover:text-red-600 transition"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : viewMode === 'analytics' ? (
            <div className="space-y-8">
              {(() => {
                const total = sorted.length || 1;
                const counts = {
                  active: sorted.filter(t => t.status === 'active').length,
                  draft: sorted.filter(t => t.status === 'draft').length,
                  deprecated: sorted.filter(t => t.status === 'deprecated').length,
                };
                const totalUsage = sorted.reduce((acc, t) => acc + t.usageCount, 0);
                const metrics = {
                  totalTemplates: sorted.length,
                  active: counts.active,
                  draft: counts.draft,
                  deprecated: counts.deprecated,
                  activeRate: counts.active / total,
                  deprecatedRate: counts.deprecated / total,
                  averageUsage: sorted.length ? totalUsage / sorted.length : 0,
                };
                return (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="p-4 rounded-md border bg-background flex flex-col gap-1">
                      <span className="text-[11px] text-muted-foreground">Total</span>
                      <span className="text-xl font-semibold">{metrics.totalTemplates}</span>
                    </div>
                    <div className="p-4 rounded-md border bg-background flex flex-col gap-1">
                      <span className="text-[11px] text-muted-foreground">Active</span>
                      <span className="text-xl font-semibold">{metrics.active}</span>
                    </div>
                    <div className="p-4 rounded-md border bg-background flex flex-col gap-1">
                      <span className="text-[11px] text-muted-foreground">Deprecated</span>
                      <span className="text-xl font-semibold">{metrics.deprecated}</span>
                    </div>
                    <div className="p-4 rounded-md border bg-background flex flex-col gap-1">
                      <span className="text-[11px] text-muted-foreground">Avg Usage</span>
                      <span className="text-xl font-semibold">{metrics.averageUsage.toFixed(1)}</span>
                    </div>
                    <div className="p-4 rounded-md border bg-background flex flex-col gap-1">
                      <span className="text-[11px] text-muted-foreground">Active Rate</span>
                      <span className="text-xl font-semibold">{(metrics.activeRate*100).toFixed(0)}%</span>
                    </div>
                    <div className="p-4 rounded-md border bg-background flex flex-col gap-1">
                      <span className="text-[11px] text-muted-foreground">Deprecated Rate</span>
                      <span className="text-xl font-semibold">{(metrics.deprecatedRate*100).toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })()}
              <div className="space-y-4">
                <h2 className="text-sm font-semibold tracking-tight">Template List (Analytics View)</h2>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {paginated.map(t => (
                    <div key={t.id} className="p-3 rounded-md border bg-background flex flex-col gap-2 text-xs">
                      <span className="font-medium line-clamp-1">{highlight(t.templateName)}</span>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{t.status}</span>
                        <span>{t.usageCount} uses</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">Owner: {highlight(t.owner)}</div>
                      <div className="text-[10px] text-muted-foreground">Mode: {t.isSequentialSigning ? 'Sequential' : 'Parallel'}</div>
                      <div className="flex items-center justify-center gap-3 pt-1">
                        <Button size="sm" className="use-template-btn" aria-label="Use template" onClick={() => setEmbeddedTemplateId(t.id)}>Use Template</Button>
                        <Button size="sm" className="brand-gradient-btn h-7 px-2 text-[10px] font-medium tracking-tight whitespace-nowrap" aria-label="View template" onClick={() => router.push(`/template-details/${t.id}`)}>View Template</Button>
                        {t.status === 'draft' && t.usageCount === 0 && (
                          <button
                            type="button"
                            aria-label="Delete template"
                            title="Delete draft template"
                            onClick={() => { setDeleteTargetId(t.id); setShowDeleteConfirm(true); }}
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
            </div>
          ) : viewMode === 'kanban' ? (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
              {(['active','draft'] as TemplateStatusUI[]).map(status => {
                const items = grouped[status];
                const meta = statusMeta[status];
                const headerStyle = status === 'active' 
                  ? 'from-green-500/20 to-green-500/5' 
                  : 'from-gray-500/20 to-gray-500/5';
                return (
                  <div key={status} className="flex flex-col gap-3 min-h-[300px]">
                    <div className={`rounded-md px-3 py-2 text-xs font-semibold bg-gradient-to-r ${headerStyle} border border-border flex items-center justify-between`}>
                      <span className="capitalize">{status}</span>
                      <span className="text-[10px] text-muted-foreground">{items.length}</span>
                    </div>
                    <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-2 overflow-y-auto min-h-[240px] max-h-[480px]">
                      {items.length === 0 ? (
                        <div className="text-[10px] text-muted-foreground italic opacity-70">Empty</div>
                      ) : items.slice((currentPage-1)*pageSize,(currentPage-1)*pageSize+pageSize).map(t => (
                        <div
                          key={t.id}
                          className="group relative rounded-lg border border-border bg-background/70 backdrop-blur px-3 py-2 flex flex-col gap-2 shadow-sm hover:shadow-md transition"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <h4 className="text-[11px] font-semibold leading-tight max-w-[70%] line-clamp-2" title={t.templateName}>
                              {highlight(t.templateName)}
                            </h4>
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-medium ${meta.bg} ${meta.color} border border-border/40`}>
                              {status}
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center justify-between">
                            <span className="flex items-center gap-1 max-w-[60%] truncate" title={t.owner}>
                              <User className="h-3 w-3" /> {highlight(t.owner)}
                            </span>
                            <span className="shrink-0">{t.usageCount} uses</span>
                          </div>
                          <div className="text-[9px] text-muted-foreground flex items-center justify-between">
                            <span>Mode: {t.isSequentialSigning ? 'Sequential' : 'Parallel'}</span>
                            <span className="opacity-70">{formatDateDDMMYYYY(t.createdDate)}</span>
                          </div>
                          <div className="mt-1 flex items-center justify-center gap-1 flex-wrap">
                            <Button
                              size="sm"
                              className="use-template-btn h-6 px-2 text-[9px] font-medium"
                              aria-label="Use template"
                              onClick={() => setEmbeddedTemplateId(t.id)}
                            >
                              Use
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 flex items-center gap-1 hover:bg-primary/10 hover:text-primary"
                              aria-label="View template"
                              onClick={() => router.push(`/template-details/${t.id}`)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              <span className="text-[9px] font-medium leading-none">View</span>
                            </Button>
                            {t.status === 'draft' && t.usageCount === 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                aria-label="Delete template"
                                title="Delete draft template"
                                className="h-6 px-2 flex items-center gap-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                                onClick={() => { setDeleteTargetId(t.id); setShowDeleteConfirm(true); }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span className="text-[9px] font-medium leading-none">Delete</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'activity' ? (
            <div className="space-y-6">
              {paginated.map(t => (
                <div key={t.id} className="flex flex-col gap-2 border-b pb-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{highlight(t.templateName)}</span>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="flex flex-wrap gap-4 text-[10px] text-muted-foreground">
                    <span>Created: {formatDateDDMMYYYY(t.createdDate)}</span>
                    <span>Updated: {formatDateDDMMYYYY(t.updatedDate)}</span>
                    <span>Usage: {t.usageCount}</span>
                    <span>Owner: {t.owner}</span>
                    <span>Mode: {t.isSequentialSigning ? 'Sequential' : 'Parallel'}</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 pt-1">
                    <Button size="sm" className="use-template-btn h-6" aria-label="Use template" onClick={() => setEmbeddedTemplateId(t.id)}>Use Template</Button>
                    <Button size="sm" className="brand-gradient-btn h-6 px-2 text-[10px] font-medium tracking-tight whitespace-nowrap" aria-label="View template" onClick={() => router.push(`/template-details/${t.id}`)}>View Template</Button>
                    {t.status === 'draft' && t.usageCount === 0 && (
                      <button
                        type="button"
                        aria-label="Delete template"
                        title="Delete draft template"
                        onClick={() => { setDeleteTargetId(t.id); setShowDeleteConfirm(true); }}
                        className="h-6 w-6 inline-flex items-center justify-center rounded-md border border-border/60 bg-background/70 hover:bg-red-50 dark:hover:bg-red-900/40 hover:text-red-600 transition"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : viewMode === 'hybrid' ? (
            <div className="relative flex w-full h-full">
              <div className="flex-1 pr-4">
                <table className="w-full text-sm border border-border rounded-md overflow-hidden">
                  <thead className="bg-muted/50 text-xs">
                    <tr className="text-muted-foreground">
                      <th className="font-medium text-left px-3 py-2">Name</th>
                      {/* Category column removed (hybrid view) */}
                      <th className="font-medium text-left px-3 py-2">Owner</th>
                      <th className="font-medium text-left px-3 py-2">Status</th>
                      <th className="font-medium text-left px-3 py-2">Usage</th>
                      <th className="font-medium text-left px-3 py-2">Mode</th>
                      <th className="font-medium text-left px-3 py-2">Created</th>
                      <th className="font-medium text-left px-3 py-2">Updated</th>
                      <th className="font-medium text-left px-3 py-2">Action</th>
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
                        <td colSpan={7} className="py-16 text-center text-muted-foreground text-sm">No templates found</td>
                      </tr>
                    ) : (
                      paginated.map(t => (
                        <tr
                          key={t.id}
                          className="group border-t border-border/60 hover:bg-muted/40 transition-colors"
                          onClick={() => setSelectedTemplateId(id => id === t.id ? null : t.id)}
                        >
                          <td className="px-3 py-2 font-medium text-sm">{highlight(t.templateName)}</td>
                          {/* Category cell removed */}
                          <td className="px-3 py-2 text-xs text-muted-foreground">{highlight(t.owner)}</td>
                          <td className="px-3 py-2"><StatusBadge status={t.status} /></td>
                          <td className="px-3 py-2 text-[11px] text-muted-foreground">{t.usageCount}</td>
                          <td className="px-3 py-2 text-[11px] text-muted-foreground">{t.isSequentialSigning ? 'Sequential' : 'Parallel'}</td>
                          <td className="px-3 py-2 text-[11px] text-muted-foreground">{formatDateDDMMYYYY(t.createdDate)}</td>
                          <td className="px-3 py-2 text-[11px] text-muted-foreground">{formatDateDDMMYYYY(t.updatedDate)}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-3 pt-1">
                              <Button size="sm" className="use-template-btn" aria-label="Use template" onClick={(e) => { e.stopPropagation(); setEmbeddedTemplateId(t.id); }}>Use Template</Button>
                              <Button size="sm" className="brand-gradient-btn h-7 px-2 text-[10px] font-medium tracking-tight whitespace-nowrap" aria-label="View template" onClick={(e) => { e.stopPropagation(); router.push(`/template-details/${t.id}`); }}>View Template</Button>
                              {t.status === 'draft' && t.usageCount === 0 && (
                                <button
                                  type="button"
                                  aria-label="Delete template"
                                  title="Delete draft template"
                                  onClick={(e) => { e.stopPropagation(); setDeleteTargetId(t.id); setShowDeleteConfirm(true); }}
                                  className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border/60 bg-background/70 hover:bg-red-50 dark:hover:bg-red-900/40 hover:text-red-600 transition"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="relative w-[380px] hidden xl:block">
                <div className={`absolute top-0 right-0 h-full w-[360px] border-l border-border bg-background/90 backdrop-blur shadow-lg transition-transform duration-300 flex flex-col ${selectedTemplateId ? 'translate-x-0' : 'translate-x-full'}`}> 
                  {selectedTemplateId ? (
                    (() => {
                      const tpl = sorted.find(t => t.id === selectedTemplateId);
                      if (!tpl) return <div className="p-4 text-xs text-muted-foreground">Selection missing.</div>;
                      return (
                        <div className="flex flex-col h-full">
                          <div className="p-4 flex items-start justify-between border-b">
                            <div className="flex flex-col gap-1">
                              <h2 className="text-lg font-semibold leading-tight">{tpl.templateName}</h2>
                              <span className="text-[11px] font-mono text-muted-foreground">{tpl.id.startsWith('temp-') ? tpl.id : `temp-${tpl.id}`}</span>
                            </div>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setSelectedTemplateId(null)}>Close</Button>
                          </div>
                          <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
                            <div className="space-y-1">
                              <span className="text-muted-foreground">Status</span>
                              <div><StatusBadge status={tpl.status} /></div>
                            </div>
                            {/* Category section removed */}
                            <div className="space-y-1">
                              <span className="text-muted-foreground">Owner</span>
                              <div className="text-sm">{tpl.owner}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <span className="text-muted-foreground">Created</span>
                                <div>{formatDateDDMMYYYY(tpl.createdDate)}</div>
                              </div>
                              <div className="space-y-1">
                                <span className="text-muted-foreground">Updated</span>
                                <div>{formatDateDDMMYYYY(tpl.updatedDate)}</div>
                              </div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-muted-foreground">Usage Count</span>
                              <div>{tpl.usageCount}</div>
                            </div>
                            <div className="space-y-1">
                              <span className="text-muted-foreground">Mode</span>
                              <div>{tpl.isSequentialSigning ? 'Sequential' : 'Parallel'}</div>
                            </div>
                            <div className="flex items-center justify-center gap-3 pt-1">
                              <Button size="sm" className="use-template-btn" aria-label="Use template" onClick={() => setEmbeddedTemplateId(tpl.id)}>Use Template</Button>
                              <Button size="sm" className="brand-gradient-btn h-7 px-2 text-[10px] font-medium tracking-tight whitespace-nowrap" aria-label="View template" onClick={() => router.push(`/template-details/${tpl.id}`)}>View Template</Button>
                              {tpl.status === 'draft' && tpl.usageCount === 0 && (
                                <button
                                  type="button"
                                  aria-label="Delete template"
                                  title="Delete draft template"
                                  onClick={() => { setDeleteTargetId(tpl.id); setShowDeleteConfirm(true); }}
                                  className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border/60 bg-background/70 hover:bg-red-50 dark:hover:bg-red-900/40 hover:text-red-600 transition"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="p-3 text-[10px] text-muted-foreground border-t">Template Drawer • Click a different row to update • Close to dismiss</div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="p-4 text-xs text-muted-foreground flex items-center justify-center h-full">Select a template row to view details</div>
                  )}
                </div>
              </div>
              {selectedTemplateId && (
                <div className="xl:hidden fixed inset-0 z-50 flex">
                  <div className="flex-1 bg-black/40" onClick={() => setSelectedTemplateId(null)} />
                  <div className="w-[80%] max-w-[400px] bg-background border-l border-border shadow-xl flex flex-col">
                    {(() => {
                      const tpl = sorted.find(t => t.id === selectedTemplateId);
                      if (!tpl) return <div className="p-4 text-xs">Missing selection.</div>;
                      return (
                        <div className="flex flex-col h-full">
                          <div className="p-4 flex items-start justify-between border-b">
                            <div className="flex flex-col gap-1">
                              <h2 className="text-base font-semibold leading-tight">{tpl.templateName}</h2>
                              <span className="text-[11px] font-mono text-muted-foreground">{tpl.id.startsWith('temp-') ? tpl.id : `temp-${tpl.id}`}</span>
                            </div>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setSelectedTemplateId(null)}>Close</Button>
                          </div>
                          <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
                            <div className="space-y-1"><span className="text-muted-foreground">Status</span><div><StatusBadge status={tpl.status} /></div></div>
                            {/* Category removed (mobile drawer) */}
                            <div className="space-y-1"><span className="text-muted-foreground">Owner</span><div className="text-sm">{tpl.owner}</div></div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1"><span className="text-muted-foreground">Created</span><div>{formatDateDDMMYYYY(tpl.createdDate)}</div></div>
                              <div className="space-y-1"><span className="text-muted-foreground">Updated</span><div>{formatDateDDMMYYYY(tpl.updatedDate)}</div></div>
                            </div>
                            <div className="space-y-1"><span className="text-muted-foreground">Usage</span><div>{tpl.usageCount}</div></div>
                            <div className="space-y-1"><span className="text-muted-foreground">Mode</span><div>{tpl.isSequentialSigning ? 'Sequential' : 'Parallel'}</div></div>
                            <div className="flex items-center justify-center gap-3 pt-1">
                              <Button size="sm" className="use-template-btn" aria-label="Use template" onClick={() => setEmbeddedTemplateId(tpl.id)}>Use Template</Button>
                              <Button size="sm" className="brand-gradient-btn h-7 px-2 text-[10px] font-medium tracking-tight whitespace-nowrap" aria-label="View template" onClick={() => router.push(`/template-details/${tpl.id}`)}>View Template</Button>
                              {tpl.status === 'draft' && tpl.usageCount === 0 && (
                                <button
                                  type="button"
                                  aria-label="Delete template"
                                  title="Delete draft template"
                                  onClick={() => { setDeleteTargetId(tpl.id); setShowDeleteConfirm(true); }}
                                  className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border/60 bg-background/70 hover:bg-red-50 dark:hover:bg-red-900/40 hover:text-red-600 transition"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
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
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <FileText className="h-10 w-10 opacity-40" />
              <span className="text-sm">Select a view mode</span>
            </div>
          )}
        </div>
        <Separator />
    <div className="px-4 py-3 bg-muted/30 text-xs text-muted-foreground flex items-center justify-between gap-4 flex-wrap">
          <span>{sorted.length} template{sorted.length === 1 ? '' : 's'} • Page {currentPage}/{totalPages} • Page Size {pageSize} • View: {viewMode} • Selected: {selectedTemplateId ?? 'none'}</span>
          <div className="flex items-center gap-2">
            <span>Sort: {sortBy} ({sortDir}) • Status Chips: {statusSet.size || 'none'}</span>
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
      )}
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { if (!isDeleting) { setShowDeleteConfirm(false); setDeleteTargetId(null); } }} />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-sm rounded-lg border border-border bg-background shadow-lg p-5 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div className="flex-1">
                <h2 className="text-base font-semibold">Delete Template</h2>
                <p className="text-xs text-muted-foreground mt-1">This will permanently remove the draft template. This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-2">
              <Button variant="outline" size="sm" disabled={isDeleting} onClick={() => { setShowDeleteConfirm(false); setDeleteTargetId(null); }}>Cancel</Button>
              <Button size="sm" disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white" onClick={async () => {
                if (!deleteTargetId) return; setIsDeleting(true);
                const result = await deleteTemplate(deleteTargetId);
                if (result.status === 'success') {
                  setMutableData(prev => prev.filter(t => t.id !== deleteTargetId));
                  toast.success('Template deleted');
                  setShowDeleteConfirm(false);
                  setDeleteTargetId(null);
                } else if (result.status === 'blocked') {
                  setBlockedDeleteInfo(result.data);
                  toast.error(`Template in use by ${result.data?.workflowCount ?? '?'} workflow(s)`);
                  setShowDeleteConfirm(false);
                } else {
                  toast.error(result.message || 'Delete failed');
                  setShowDeleteConfirm(false);
                }
                setIsDeleting(false);
              }}>{isDeleting ? 'Deleting...' : 'Delete'}</Button>
            </div>
          </div>
        </div>
      )}
      {/* Blocked (in-use) Modal */}
      {blockedDeleteInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setBlockedDeleteInfo(null)} />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-lg rounded-lg border border-border bg-background shadow-lg p-5 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div className="flex-1">
                <h2 className="text-base font-semibold">Template In Use</h2>
                <p className="text-xs text-muted-foreground mt-1">This template is referenced by {blockedDeleteInfo.workflowCount} workflow{blockedDeleteInfo.workflowCount===1?'':'s'} and cannot be deleted.</p>
              </div>
            </div>
            <div className="max-h-56 overflow-auto rounded border border-border/60 bg-muted/30 p-2 text-[11px] space-y-1">
              {blockedDeleteInfo.workflows.map(w => (
                <div key={w.workflowId} className="flex items-center justify-between gap-2 py-1 px-2 rounded hover:bg-muted/50">
                  <span className="font-mono text-[10px]">#{w.workflowId}</span>
                  <span className="flex-1 truncate">{w.workflowName || 'Untitled Workflow'}</span>
                  <span className="text-muted-foreground text-[10px]">{w.status}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setBlockedDeleteInfo(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateListPage;
