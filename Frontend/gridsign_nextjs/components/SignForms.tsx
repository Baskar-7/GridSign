"use client";
import React, { useEffect, useState, useMemo } from 'react';
import { formatDateDDMMYYYY } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { RefreshCw, Search, CheckCircle, FileText, LayoutGrid, List, X, Table, Columns, Calendar, Expand, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface SignFormItem {
  id: string;
  title: string;
  requester: string;
  requestedAt: string; // ISO string from backend
  status: 'Pending' | 'Signed' | 'Expired';
  dueDate?: string; // ISO
  pages?: number | null;
}

interface SignFormsSummaryDto {
  items: SignFormItem[];
  totalPending: number;
  totalSigned: number;
  totalExpired: number;
  totalAll: number;
}

import { useApiQuery } from '@/hooks/useApiQuery';
import { apiUrl } from '@/lib/apiConfig';

const STATUS_COLORS: Record<string,string> = {
  Pending: 'bg-amber-500',
  Signed: 'bg-emerald-600',
  Expired: 'bg-red-600'
};
const STATUS_ICON: Record<string, React.ReactNode> = {
  Pending: <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />,
  Signed: <div className="h-2 w-2 rounded-full bg-emerald-600" />,
  Expired: <div className="h-2 w-2 rounded-full bg-red-600" />,
};

// Advanced UI component for sign forms
const SignForms: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(()=>{ setMounted(true); },[]);

  // Preferences
  const PREF_KEY = 'signFormsPrefs';
  interface Prefs {
    viewMode: 'grid' | 'list' | 'table' | 'compact' | 'kanban' | 'timeline';
    altPalette?: boolean;
    statusFilters: string[];
    search: string;
    sortField: 'requestedAt' | 'dueDate' | 'title';
    sortDir: 'asc' | 'desc';
    dateRange: '7d' | '30d' | '90d' | 'all';
  }
  const defaultPrefs: Prefs = { viewMode:'grid', statusFilters:[], search:'', sortField:'requestedAt', sortDir:'desc', dateRange:'30d', altPalette:false };
  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs);
  const [loadedPrefs, setLoadedPrefs] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(24);
  useEffect(()=>{
    try { const raw = localStorage.getItem(PREF_KEY); if(raw){ setPrefs({...defaultPrefs, ...JSON.parse(raw)}); } } catch {}
    setLoadedPrefs(true);
  },[]);
  // Load global gridsignPrefs overrides for view & status filters if present
  useEffect(() => {
    if(!loadedPrefs) return;
    try {
      const raw = localStorage.getItem('gridsignPrefs');
      if(raw){
        const gp = JSON.parse(raw);
        const allowedViews = ['grid','list','table','compact','kanban','timeline'];
        setPrefs(p => ({
          ...p,
          viewMode: gp.signFormsViewMode && allowedViews.includes(gp.signFormsViewMode) ? gp.signFormsViewMode : p.viewMode,
          statusFilters: Array.isArray(gp.signFormsStatusFilters) ? gp.signFormsStatusFilters.filter((s:string)=>['Pending','Signed','Expired'].includes(s)) : p.statusFilters,
        }));
      }
    } catch {}
  }, [loadedPrefs]);
  useEffect(()=>{ if(loadedPrefs){ try{ localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); }catch{} } },[prefs,loadedPrefs]);
  // Persist into global gridsignPrefs whenever viewMode or statusFilters change
  useEffect(() => {
    if(!loadedPrefs) return;
    try {
      const raw = localStorage.getItem('gridsignPrefs');
      const gp = raw ? JSON.parse(raw) : {};
      gp.signFormsViewMode = prefs.viewMode;
      gp.signFormsStatusFilters = prefs.statusFilters;
      gp.updatedAt = new Date().toISOString();
      localStorage.setItem('gridsignPrefs', JSON.stringify(gp));
      // Dispatch storage event for listeners (Profile Dashboard)
      window.dispatchEvent(new StorageEvent('storage',{ key:'gridsignPrefs', newValue: JSON.stringify(gp) }));
    } catch {}
  }, [prefs.viewMode, prefs.statusFilters, loadedPrefs]);

  // Query backend sign forms (replaces dummy generator)
  const { data, isLoading, error, refetch } = useApiQuery<SignFormsSummaryDto>({
    queryKey: ['signForms', prefs.dateRange, prefs.statusFilters.join(','), prefs.search, prefs.sortField, prefs.sortDir],
    endpoint: '/api/workflow/getSignForms',
    method: 'POST',
    enabled: loadedPrefs, // wait until preferences loaded to avoid duplicate fetch
    body: {
      pageNumber,
      pageSize,
      searchTerm: prefs.search || undefined,
      sortBy: prefs.sortField, // requestedAt | dueDate | title
      isDescending: prefs.sortDir === 'desc',
      statuses: prefs.statusFilters.length ? prefs.statusFilters : undefined,
      dateRange: prefs.dateRange
    }
  });

  // Defensive extraction: backend may return a reference-preserved object with $values wrapper
  const unwrapValues = (v: any): any => {
    if (v && typeof v === 'object' && Array.isArray(v.$values)) return v.$values;
    return v;
  };
  const rawItemsContainer = data?.data?.items as any;
  const rawItems = unwrapValues(rawItemsContainer);
  const backendItems: SignFormItem[] = Array.isArray(rawItems) ? rawItems : [];
  const totalPending = data?.data?.totalPending ?? 0;
  const totalSigned = data?.data?.totalSigned ?? 0;
  const totalExpired = data?.data?.totalExpired ?? 0;
  const totalAll = data?.data?.totalAll ?? 0;

  const refreshAll = () => refetch();
  // Combined list directly from backend items (already mixed statuses)
  const combined: SignFormItem[] = Array.isArray(backendItems) ? backendItems : [];

  // Derived filtered list
  const activeList = useMemo(()=>{
    // If combined ever resolves to a non-array, fallback to empty list and optionally log in dev
    const baseArray: SignFormItem[] = Array.isArray(combined) ? combined : [];
    let list: SignFormItem[] = [...baseArray];
    if(prefs.search){ list = list.filter(i => i.title.toLowerCase().includes(prefs.search.toLowerCase()) || i.requester.toLowerCase().includes(prefs.search.toLowerCase())); }
    if(prefs.statusFilters.length){ list = list.filter(i => prefs.statusFilters.includes(i.status)); }
    list.sort((a,b)=>{
      const field = prefs.sortField;
      const av = a[field] || '';
      const bv = b[field] || '';
      if(av < bv) return prefs.sortDir==='asc'? -1 : 1;
      if(av > bv) return prefs.sortDir==='asc'? 1 : -1;
      return 0;
    });
    return list;
  },[prefs, combined]);

  const toggleStatusFilter = (status:string) => setPrefs(p => ({...p, statusFilters: p.statusFilters.includes(status) ? p.statusFilters.filter(s=>s!==status) : [...p.statusFilters, status]}));
  const clearFilters = () => setPrefs(p => ({...p, statusFilters: [], search:'' }));
  const changeView = (v: Prefs['viewMode']) => setPrefs(p=>({...p, viewMode:v}));
  // Selection feature removed per requirement (bulk actions deprecated)
  const changeSort = (field: Prefs['sortField']) => setPrefs(p=>({...p, sortField: field, sortDir: p.sortField===field && p.sortDir==='asc' ? 'desc' : 'asc'}));

  // Optimistic sign action (moves from pendingRaw to signedRaw locally)
  const router = useRouter();
  const signDocument = async (id:string) => {
    // Use the sign form details response which now includes the token
    try {
      const envelopeId = parseInt(id, 10);
      if (Number.isNaN(envelopeId)) throw new Error('Invalid envelope id');
      const tokenJwt = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const detailsRes = await fetch(apiUrl(`/workflow/signForm/details?envelopeId=${envelopeId}`), {
        method: 'GET',
        headers: { ...(tokenJwt ? { Authorization: `Bearer ${tokenJwt}` } : {}) }
      });
      const detailsJson = await detailsRes.json();
      const data = detailsJson?.data || detailsJson?.Data;
      const recipients = (data?.recipients?.$values ?? data?.recipients ?? []) as any[];
      const current = Array.isArray(recipients) ? recipients.find((r:any) => (r?.isCurrentSigner ?? r?.IsCurrentSigner)) ?? recipients[0] : null;
      const recipientId = current?.workflowRecipientId ?? current?.WorkflowRecipientId;
      const token = data?.token ?? data?.Token;
      if (!recipientId || recipientId <= 0) throw new Error('Recipient not found');
      if (!token) throw new Error('Missing signing token');
      router.push(`/sign/${encodeURIComponent(id)}?recipientId=${recipientId}&token=${encodeURIComponent(token)}`);
    } catch (e:any) {
      toast.error(e.message || 'Unable to start signing');
    }
  };
  const resendEnvelope = async (id: string) => {
    try {
      const envelopeId = parseInt(id,10);
      if (Number.isNaN(envelopeId)) return;
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const res = await fetch(apiUrl('/workflow/resendEnvelope'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token? { Authorization: `Bearer ${token}` }: {}) },
        body: JSON.stringify(envelopeId)
      });
      const json = await res.json();
      if (json.status === 'success') {
        toast.success('Envelope resent');
        refetch();
      } else {
        toast.error(json.message || 'Failed to resend');
      }
    } catch (e:any) {
      toast.error(e.message || 'Error resending envelope');
    }
  };
  // Bulk sign removed per requirement

  // Skeletons
  const renderSkeletonGrid = () => (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({length:8}).map((_,i)=>(
        <Card key={i} className="border-border">
          <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const isLoadingActive = isLoading;
  const errorActive = error ? { message: error.message } : null;

  // Pagination derived values
  const totalPages = Math.max(1, Math.ceil(totalAll / pageSize));
  const startIdx = (pageNumber - 1) * pageSize + 1;
  const endIdx = Math.min(pageNumber * pageSize, totalAll);

  return (
    <div className="space-y-7 max-w-7xl mx-auto px-4 md:px-6 py-6">
      {/* Header */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-3">Sign Forms <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground font-medium">Beta</span></h1>
          <p className="text-sm text-muted-foreground max-w-prose">Track, review and action signature requests. Use filters to narrow and switch views for dense or detailed layouts.</p>
        </div>
  <div className="flex flex-wrap gap-2 items-center xl:ml-auto xl:justify-end">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={prefs.search} onChange={e=>setPrefs(p=>({...p, search:e.target.value}))} placeholder="Search title or requester" className="pl-9 w-80 shadow-sm" />
          </div>
          <select value={prefs.dateRange} onChange={e=>setPrefs(p=>({...p, dateRange: e.target.value as Prefs['dateRange']}))} className="h-9 px-3 rounded-md border border-border bg-background text-sm shadow-sm">
            <option value="7d">Last 7d</option>
            <option value="30d">Last 30d</option>
            <option value="90d">Last 90d</option>
            <option value="all">All time</option>
          </select>
          <Button size="sm" variant="outline" className="shadow-sm" onClick={refreshAll}><RefreshCw className="h-4 w-4 mr-1" />Refresh</Button>
          <div className="inline-flex rounded-md overflow-hidden border bg-background shadow-sm">
            {[
              {key:'grid', icon:<LayoutGrid className="h-4 w-4" />, label:'Grid'},
              {key:'list', icon:<List className="h-4 w-4" />, label:'List'},
              {key:'table', icon:<Table className="h-4 w-4" />, label:'Table'},
              {key:'compact', icon:<Columns className="h-4 w-4" />, label:'Compact'},
              {key:'kanban', icon:<Expand className="h-4 w-4" />, label:'Kanban'},
              {key:'timeline', icon:<Calendar className="h-4 w-4" />, label:'Timeline'},
            ].map(v => (
              <button key={v.key} onClick={()=>changeView(v.key as Prefs['viewMode'])}
                className={`px-4 h-9 text-xs font-medium ${prefs.viewMode===v.key?'bg-muted':'hover:bg-muted/50'} flex items-center gap-1 border-r last:border-r-0`} aria-pressed={prefs.viewMode===v.key}>{v.icon}{v.label}</button>
            ))}
          </div>
          {/* Selection actions removed (bulk sign feature deprecated) */}
        </div>
      </div>

      {/* Metrics Row */}
  <div className="grid gap-4 md:grid-cols-4 sm:grid-cols-2">
        <Card className="group relative overflow-hidden border-border">
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-1"><span className="text-xs font-medium text-muted-foreground">Pending</span>{STATUS_ICON.Pending}</div>
            <p className="text-2xl font-semibold tracking-tight">{totalPending}</p>
            <p className="text-[11px] text-muted-foreground">Awaiting your signature</p>
          </CardContent>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-amber-400/80 to-amber-600" />
        </Card>
        <Card className="group relative overflow-hidden border-border">
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-1"><span className="text-xs font-medium text-muted-foreground">Signed</span>{STATUS_ICON.Signed}</div>
            <p className="text-2xl font-semibold tracking-tight">{totalSigned}</p>
            <p className="text-[11px] text-muted-foreground">Successfully completed</p>
          </CardContent>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-emerald-400/80 to-emerald-600" />
        </Card>
        <Card className="group relative overflow-hidden border-border">
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-1"><span className="text-xs font-medium text-muted-foreground">Expired</span>{STATUS_ICON.Expired}</div>
            <p className="text-2xl font-semibold tracking-tight">{totalExpired}</p>
            <p className="text-[11px] text-muted-foreground">Need resend or removal</p>
          </CardContent>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-red-400/80 to-red-600" />
        </Card>
        <Card className="group relative overflow-hidden border-border">
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-1"><span className="text-xs font-medium text-muted-foreground">Total</span><div className="h-2 w-2 rounded-full bg-primary" /></div>
            <p className="text-2xl font-semibold tracking-tight">{totalAll}</p>
            <p className="text-[11px] text-muted-foreground">Across current range</p>
          </CardContent>
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-primary/70 to-primary" />
        </Card>
      </div>

      {/* Filters Row: inline counts inside buttons */}
      <div className="flex flex-wrap gap-4 items-center bg-muted/40 rounded-md px-3 py-3 border border-border/50">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Status:</span>
          {[{key:'Pending',count:totalPending,color:'bg-amber-500'}, {key:'Signed',count:totalSigned,color:'bg-emerald-600'}, {key:'Expired',count:totalExpired,color:'bg-red-600'}].map(s => (
            <button
              key={s.key}
              onClick={()=>toggleStatusFilter(s.key)}
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border transition ${prefs.statusFilters.includes(s.key)?'bg-primary text-primary-foreground border-primary':'bg-background hover:bg-muted text-foreground'}`}
              aria-pressed={prefs.statusFilters.includes(s.key)}
            >
              <span className={`w-2 h-2 rounded-full ${s.color}`} />
              <span>{s.key}</span>
              <span className="opacity-70">({s.count})</span>
            </button>
          ))}
          <span className="text-[10px] text-muted-foreground ml-2">Total: {totalAll}</span>
          {(prefs.statusFilters.length > 0 || prefs.search) && (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-2 inline-flex items-center gap-1 px-2 py-1 rounded-md border bg-background hover:bg-muted text-[10px] font-medium text-muted-foreground transition"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-muted-foreground">Sort:</span>
          {['requestedAt','dueDate','title'].map(f => (
            <button
              key={f}
              onClick={()=>changeSort(f as Prefs['sortField'])}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition ${prefs.sortField===f?'bg-primary text-primary-foreground border-primary':'bg-muted hover:bg-muted/70 text-foreground'}`}
            >{f}{prefs.sortField===f? (prefs.sortDir==='asc'? ' ↑':' ↓'):''}</button>
          ))}
        </div>
      </div>

          {/* Tabs removed: unified list with status filter chips above */}

      {/* Content */}
      <div className="space-y-4">
        {errorActive && <div className="p-4 border border-red-300 bg-red-50 dark:bg-red-950/30 text-sm rounded">Failed to load: {errorActive.message}</div>}
        {isLoadingActive && renderSkeletonGrid()}
        {!isLoadingActive && !activeList.length && (
          <Card className="border-dashed">
            <CardContent className="py-14 text-center space-y-4">
              <div className="mx-auto h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">No documents match your filters</p>
                <p className="text-xs text-muted-foreground">Try adjusting status or clearing search.</p>
              </div>
              <Button size="sm" variant="outline" onClick={clearFilters}>Reset Filters</Button>
            </CardContent>
          </Card>
        )}
        {!isLoadingActive && activeList.length > 0 && (
          prefs.viewMode==='grid' ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {activeList.map(item => {
                const overdue = item.dueDate && new Date(item.dueDate) < new Date() && item.status==='Pending';
                return (
                  <Card key={item.id} className="group border-border hover:shadow-lg transition relative overflow-hidden bg-gradient-to-br from-background to-muted/30 flex flex-col">
                    <CardHeader className="pb-2 flex-shrink-0 relative z-10">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex-1 truncate max-w-[75%] text-sm font-semibold" title={item.title}>{item.title}</span>
                        <Badge className={`${STATUS_COLORS[item.status]} text-white text-[10px] shadow-sm shrink-0`} title={item.status}>{item.status}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 text-xs flex-1 flex flex-col">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">Requester</span>
                        <span className="font-medium max-w-[140px] overflow-hidden text-ellipsis whitespace-nowrap" title={item.requester}>{item.requester}</span>
                      </div>
                        <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Requested</span><span className="font-medium">{formatDateDDMMYYYY(item.requestedAt)}</span></div>
                      {item.dueDate && <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Due</span><span className={`font-medium ${overdue? 'text-red-600 dark:text-red-400':''}`}>{formatDateDDMMYYYY(item.dueDate)}</span></div>}
                      {typeof item.pages === 'number' && item.pages > 0 && <div className="flex items-center justify-between gap-2"><span className="text-muted-foreground">Pages</span><span className="font-medium">{item.pages}</span></div>}
                      <div className="mt-auto pt-1">
                        {item.status==='Pending' && (
                          <Button size="sm" className="w-full" onClick={()=>signDocument(item.id)}><CheckCircle className="h-4 w-4 mr-1" />Sign</Button>
                        )}
                        {item.status==='Expired' && (
                          <Button size="sm" variant="outline" className="w-full" onClick={()=>resendEnvelope(item.id)}><RotateCcw className="h-4 w-4 mr-1" />Resend</Button>
                        )}
                      </div>
                    </CardContent>
                    {overdue && <div className="absolute inset-0 pointer-events-none bg-red-500/5" />}
                    <div className="absolute top-0 right-0 w-12 h-12 bg-gradient-to-bl from-primary/40 to-transparent opacity-0 group-hover:opacity-100 transition z-0 pointer-events-none" />
                  </Card>
                );
              })}
            </div>
          ) : prefs.viewMode==='list' ? (
            <div className="divide-y divide-border border rounded-md overflow-hidden">
              {activeList.map(item => {
                const overdue = item.dueDate && new Date(item.dueDate) < new Date() && item.status==='Pending';
                return (
                  <div key={item.id} className="p-4 flex flex-col sm:flex-row gap-4 hover:bg-muted/50 transition group">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate max-w-[240px]" title={item.title}>{item.title}</span>
                        <Badge className={`${STATUS_COLORS[item.status]} text-white text-[10px] shadow-sm flex-shrink-0`}>{item.status}</Badge>
                        {overdue && <span className="text-[10px] text-red-600 dark:text-red-400 font-semibold">Overdue</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate max-w-[200px]" title={item.requester}>Requester: {item.requester}</p>
                      <div className="flex flex-wrap gap-4 text-[11px]">
                        <span>Requested: {formatDateDDMMYYYY(item.requestedAt)}</span>
                        {item.dueDate && <span>Due: <span className={overdue? 'text-red-600 dark:text-red-400':''}>{formatDateDDMMYYYY(item.dueDate)}</span></span>}
                        {typeof item.pages === 'number' && item.pages > 0 && <span>Pages: {item.pages}</span>}
                      </div>
                    </div>
                    {item.status==='Pending' && (
                      <div className="flex items-center">
                        <Button size="sm" onClick={()=>signDocument(item.id)}><CheckCircle className="h-4 w-4 mr-1" />Sign</Button>
                      </div>
                    )}
                    {item.status==='Expired' && (
                      <div className="flex items-center">
                        <Button size="sm" variant="outline" onClick={()=>resendEnvelope(item.id)}><RotateCcw className="h-4 w-4 mr-1" />Resend</Button>
                      </div>
                    )}
                    <div className="absolute inset-y-0 right-0 w-1 bg-gradient-to-b from-primary/40 to-primary/10 opacity-0 group-hover:opacity-100 transition" />
                  </div>
                );
              })}
            </div>
          ) : prefs.viewMode==='table' ? (
            <div className="overflow-auto border rounded-md">
              <table className="min-w-full text-xs table-fixed">
                <thead className="bg-muted">
                  <tr className="text-left">
                    <th className="p-2 w-[180px]">Title</th>
                    <th className="p-2 w-[120px]">Requester</th>
                    <th className="p-2 w-[80px]">Status</th>
                    <th className="p-2 w-[100px]">Requested</th>
                    <th className="p-2 w-[100px]">Due</th>
                    <th className="p-2 w-[70px]">Pages</th>
                    <th className="p-2 w-[120px]">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeList.map(item => {
                    const overdue = item.dueDate && new Date(item.dueDate) < new Date() && item.status==='Pending';
                    return (
                      <tr key={item.id} className="border-t hover:bg-muted/50">
                        <td className="p-2 max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap" title={item.title}>{item.title}</td>
                        <td className="p-2 max-w-[120px] overflow-hidden text-ellipsis whitespace-nowrap" title={item.requester}>{item.requester}</td>
                        <td className="p-2"><Badge className={`${STATUS_COLORS[item.status]} text-white text-[10px]`}>{item.status}</Badge></td>
                        <td className="p-2 whitespace-nowrap">{formatDateDDMMYYYY(item.requestedAt)}</td>
                        <td className="p-2 whitespace-nowrap">{item.dueDate? <span className={overdue? 'text-red-600 dark:text-red-400':''}>{formatDateDDMMYYYY(item.dueDate)}</span> : '-'}</td>
                        <td className="p-2">{typeof item.pages === 'number' && item.pages > 0 ? item.pages : '-'}</td>
                        <td className="p-2 flex gap-2 flex-wrap">{item.status==='Pending' && <Button size="sm" onClick={()=>signDocument(item.id)}>Sign</Button>}{item.status==='Expired' && <Button size="sm" variant="outline" onClick={()=>resendEnvelope(item.id)}>Resend</Button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : prefs.viewMode==='compact' ? (
            <div className="grid gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {activeList.map(item => {
                const overdue = item.dueDate && new Date(item.dueDate) < new Date() && item.status==='Pending';
                return (
                  <div key={item.id} className="relative p-3 rounded-md border group hover:shadow-sm transition bg-background">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`${STATUS_COLORS[item.status]} text-white text-[10px]`}>{item.status}</Badge>
                      <span className="truncate text-xs font-medium" title={item.title}>{item.title}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{formatDateDDMMYYYY(item.requestedAt)}</span>
                      {item.pages && <span>{item.pages}p</span>}
                    </div>
                    {overdue && <span className="absolute top-1 right-2 text-[9px] font-semibold text-red-600">Overdue</span>}
                  </div>
                );
              })}
            </div>
          ) : prefs.viewMode==='kanban' ? (
            <div className="grid gap-4 md:grid-cols-3">
              {['Pending','Signed','Expired'].map(col => {
                const columnItems = activeList.filter(i=>i.status===col);
                return (
                  <div key={col} className="flex flex-col rounded-md border bg-muted/30">
                    <div className="px-3 py-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wide">
                      <span>{col}</span><span className="text-[10px] text-muted-foreground">{columnItems.length}</span>
                    </div>
                    <div className="space-y-2 p-2">
                      {columnItems.map(item => {
                        const overdue = item.dueDate && new Date(item.dueDate) < new Date() && item.status==='Pending';
                        return (
                          <div key={item.id} className="p-3 rounded-md border bg-background hover:bg-muted/50 transition text-xs space-y-1 flex flex-col">
                            <div className="flex items-center justify-between gap-2"><span className="font-medium truncate max-w-[140px]" title={item.title}>{item.title}</span><Badge className={`${STATUS_COLORS[item.status]} text-white text-[9px] flex-shrink-0`}>{item.status}</Badge></div>
                            <div className="flex justify-between text-[9px] text-muted-foreground">
                              <span>{formatDateDDMMYYYY(item.requestedAt)}</span>
                              {typeof item.pages === 'number' && item.pages > 0 && <span>{item.pages}p</span>}
                            </div>
                            {overdue && <span className="text-[9px] text-red-600 font-semibold">Overdue</span>}
                            {item.status==='Pending' && <Button size="sm" className="w-full" onClick={()=>signDocument(item.id)}>Sign</Button>}
                            {item.status==='Expired' && <Button size="sm" variant="outline" className="w-full" onClick={()=>resendEnvelope(item.id)}>Resend</Button>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="relative space-y-4 before:absolute before:left-4 before:top-0 before:bottom-0 before:w-px before:bg-border">
              {activeList.map(item => {
                const overdue = item.dueDate && new Date(item.dueDate) < new Date() && item.status==='Pending';
                return (
                  <div key={item.id} className="relative pl-12">
                    <div className="absolute left-2 top-2 h-4 w-4 rounded-full flex items-center justify-center bg-background border shadow-sm">
                      <div className={`h-2 w-2 rounded-full ${STATUS_COLORS[item.status]}`}></div>
                    </div>
                    <div className="p-4 rounded-md border bg-background hover:bg-muted/40 transition">
                      <div className="flex items-center gap-2 mb-1 text-xs font-medium">
                        <span className="truncate" title={item.title}>{item.title}</span>
                        <Badge className={`${STATUS_COLORS[item.status]} text-white text-[9px]`}>{item.status}</Badge>
                        {overdue && <span className="text-[9px] text-red-600 font-semibold">Overdue</span>}
                      </div>
                      <div className="flex flex-wrap gap-4 text-[10px] text-muted-foreground">
                        <span>Requested: {formatDateDDMMYYYY(item.requestedAt)}</span>
                        {item.dueDate && <span>Due: <span className={overdue? 'text-red-600 dark:text-red-400':''}>{formatDateDDMMYYYY(item.dueDate)}</span></span>}
                        {item.pages && <span>Pages: {item.pages}</span>}
                      </div>
                      {item.status==='Pending' && <div className="mt-2"><Button size="sm" onClick={()=>signDocument(item.id)}>Sign</Button></div>}
                      {item.status==='Expired' && <div className="mt-2"><Button size="sm" variant="outline" onClick={()=>resendEnvelope(item.id)}>Resend</Button></div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
        {/* Pagination Controls */}
        {!isLoadingActive && totalAll > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t mt-6">
            <div className="text-xs text-muted-foreground">
              Showing {startIdx}-{endIdx} of {totalAll}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                disabled={pageNumber === 1}
                className="h-8 px-3 rounded-md border text-xs disabled:opacity-40 disabled:cursor-not-allowed bg-background hover:bg-muted"
              >Prev</button>
              <span className="text-xs">Page {pageNumber} / {totalPages}</span>
              <button
                onClick={() => setPageNumber(p => Math.min(totalPages, p + 1))}
                disabled={pageNumber >= totalPages}
                className="h-8 px-3 rounded-md border text-xs disabled:opacity-40 disabled:cursor-not-allowed bg-background hover:bg-muted"
              >Next</button>
              <select
                value={pageSize}
                onChange={e => { setPageNumber(1); setPageSize(parseInt(e.target.value)); }}
                className="h-8 px-2 rounded-md border text-xs bg-background"
              >
                {[12,24,48,96].map(sz => <option key={sz} value={sz}>{sz}/page</option>)}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SignForms;
