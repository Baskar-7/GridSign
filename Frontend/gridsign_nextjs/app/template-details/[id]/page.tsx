"use client";
import React, { useMemo, useState } from 'react';
import { formatDateDDMMYYYY } from '@/lib/utils';
import { useParams, useRouter } from 'next/navigation';
import { TemplateDetailsUI } from '@/types/template';
import { useFileResource } from '@/hooks/useFileResource';
import DocumentFieldMapper from '@/components/prepare-document/DocumentFieldMapper';
import { BrandLogo } from '@/components/BrandLogo';
import { ArrowLeft, RefreshCcw, AlertTriangle, FileText, Users, ListChecks, Paperclip, User, Info, Bookmark, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import { useTemplateDetails } from '@/hooks/useTemplateDetails';
import SendForSignaturePage from '@/components/send-for-signature/SendForSignaturePage';
import BackButton from '@/components/ui/BackButton';

const SkeletonLines: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <div className="flex flex-col gap-2 w-full animate-pulse">
    {Array.from({ length: count }).map((_,i) => <div key={i} className="h-4 w-full bg-muted rounded" />)}
  </div>
);

const TemplateDetailsProfessionalPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const idParam = params?.id as string | undefined;
  const templateId = idParam ? Number(idParam) : NaN;

  // useTemplateDetails already returns a mapped TemplateDetailsUI (no $values wrappers)
  const { data: apiResponse, isLoading, isError, refetch } = useTemplateDetails({ templateId });
  const [startUseTemplate, setStartUseTemplate] = useState(false);
  const data: TemplateDetailsUI | undefined = apiResponse?.data;
  const totals = useMemo(() => ({
    docs: data?.documents.length ?? 0,
    recips: data?.totalRecipients ?? 0,
    fields: data?.totalFields ?? 0,
    files: data?.totalFiles ?? 0
  }), [data]);


  const recipientColorMap = useMemo(() => {
    if (!data) return [];
    const GOLDEN_ANGLE = 137.508;
    const hashString = (str: string) => { let h = 0; for (let i=0;i<str.length;i++) h = Math.imul(31,h)+str.charCodeAt(i)|0; return h>>>0; };
    const colorForRecipient = (identifier: string, index: number) => {
      const seed = (hashString(identifier)+index)%1000; const hue = (seed*GOLDEN_ANGLE)%360; return `hsl(${hue.toFixed(2)},72%,54%)`;
    };
    const unique: Record<string,{id:string; email:string; name:string; color:string}> = {};
    let runningIndex = 0;
    data.documents.forEach(doc => {
      doc.recipients.forEach(r => {
        const key = (r.defaultUserEmail || 'unknown') + '|' + (r.defaultUserName || 'User');
        if (!unique[key]) {
          unique[key] = { id: key, email: r.defaultUserEmail, name: r.defaultUserName, color: colorForRecipient(r.defaultUserEmail || key, runningIndex) };
          runningIndex++;
        }
      });
    });
    // Append pseudo common recipient if backend supplied any commonFields and signing is parallel
    const hasCommon = data.documents.some(d => d.commonFields && d.commonFields.length > 0);
    if (hasCommon && !data.isSequentialSigning) {
      unique['__COMMON__'] = { id: '__COMMON__', email: 'all@recipients', name: 'Shared', color: '#6b7280' };
    }
    return Object.values(unique);
  }, [data]);

  // Locate first available file (robust against missing or empty arrays)
  const firstFile = useMemo(() => {
    if (!data) return undefined;
    for (const doc of data.documents) {
      if (doc.files.length > 0) return doc.files[0];
    }
    return undefined;
  }, [data]);
  const fileResourceId = firstFile?.fileId ?? null; // fileId mapped from fileResourceId in mapper
  const { fileUrl: pdfUrl, loading: fileLoading, error: fileError } = useFileResource({
    fileResourceId: fileResourceId ?? 0,
    enabled: !!fileResourceId
  });
  const [previewZoom, setPreviewZoom] = useState(1);

  // Build preset fields from recipient field metadata (requires x,y parsed earlier)
  const presetFields = useMemo(() => {
    if (!data) return [] as { id: number | null; key: string; type: string; required: boolean; x?: number | null; y?: number | null; page?: number | null; width?: number | null; height?: number | null; recipientId?: string | null }[];
    const collected: { id: number | null; key: string; type: string; required: boolean; x?: number | null; y?: number | null; page?: number | null; width?: number | null; height?: number | null; recipientId?: string | null }[] = [];
    data.documents.forEach(doc => {
      // Add common fields first (single placement, shared recipient id)
      if (!data.isSequentialSigning && doc.commonFields && doc.commonFields.length) {
        doc.commonFields.forEach(cf => {
          let xVal = cf.x ?? null; let yVal = cf.y ?? null;
          if ((xVal === null || yVal === null) && cf.position) {
            const parts = (cf.position || '').split(',').map(p => p.trim());
            const px = parseFloat(parts[0]); const py = parts.length > 1 ? parseFloat(parts[1]) : NaN;
            if (!Number.isNaN(px)) xVal = px; if (!Number.isNaN(py)) yVal = py;
          }
          let pageVal: number | null = cf.page ?? null; let widthVal: number | null = cf.width ?? null; let heightVal: number | null = cf.height ?? null;
          if (cf.position && typeof cf.position === 'string') {
            const parts = cf.position.split(',').map(p => p.trim());
            if (parts.length >= 3) { const pPage = parseInt(parts[2]); if (!Number.isNaN(pPage)) pageVal = pPage; }
            if (parts.length >= 5) { const pW = parseFloat(parts[3]); const pH = parseFloat(parts[4]); if (!Number.isNaN(pW)) widthVal = pW; if (!Number.isNaN(pH)) heightVal = pH; }
          }
          collected.push({
            id: cf.id,
            key: cf.key,
            type: cf.type,
            required: cf.required,
            x: xVal, y: yVal, page: pageVal ?? 1, width: widthVal, height: heightVal,
            recipientId: '__COMMON__'
          });
        });
      }
      // Recipient-specific fields
      doc.recipients.forEach(rec => {
        rec.fields.filter(f => !f.isCommonField).forEach(f => {
          let xVal = f.x ?? null; let yVal = f.y ?? null;
          if ((xVal === null || yVal === null) && f.position) {
            const parts = (f.position || '').split(',').map(p => p.trim());
            const px = parseFloat(parts[0]); const py = parts.length > 1 ? parseFloat(parts[1]) : NaN;
            if (!Number.isNaN(px)) xVal = px; if (!Number.isNaN(py)) yVal = py;
          }
          let pageVal: number | null = f.page ?? null; let widthVal: number | null = f.width ?? null; let heightVal: number | null = f.height ?? null;
          if (f.position && typeof f.position === 'string') {
            const parts = f.position.split(',').map(p => p.trim());
            if (parts.length >= 3) { const pPage = parseInt(parts[2]); if (!Number.isNaN(pPage)) pageVal = pPage; }
            if (parts.length >= 5) { const pW = parseFloat(parts[3]); const pH = parseFloat(parts[4]); if (!Number.isNaN(pW)) widthVal = pW; if (!Number.isNaN(pH)) heightVal = pH; }
          }
          collected.push({
            id: f.id,
            key: f.key,
            type: f.type,
            required: f.required,
            x: xVal, y: yVal, page: pageVal ?? 1, width: widthVal, height: heightVal,
            recipientId: `${rec.defaultUserEmail || 'unknown'}|${rec.defaultUserName || 'User'}`
          });
        });
      });
    });
    console.log('[TemplateDetails] presetFields built', { total: collected.length, common: collected.filter(c => c.recipientId === '__COMMON__').length });
    return collected;
  }, [data]);

  const debug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1';

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <SkeletonLines count={8} />
        <span className="text-xs text-muted-foreground">Loading template details...</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-4">
        <AlertTriangle className="h-8 w-8 text-destructive" />
        <span className="text-sm font-medium">Failed to load template details</span>
        <span className="text-xs text-muted-foreground">Template ID: {templateId}</span>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="flex items-center gap-1"><RefreshCcw className="h-3 w-3" />Retry</Button>
      </div>
    );
  }

  // When user chooses to use the template, embed the SendForSignaturePage with use-template mode
  if (startUseTemplate) {
    return (
      <div className="w-full flex flex-col">
        {/* Top header nav for embedded use-template mode */}
        <div className="fixed top-0 left-0 right-0 h-14 px-5 flex items-center justify-between border-b bg-background/95 backdrop-blur z-50">
          <div className="flex items-center gap-3">
            <BackButton ariaLabel="Back to template details" onClick={() => setStartUseTemplate(false)} size="sm" />
            <div className="flex flex-col">
              <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <button type="button" onClick={() => setStartUseTemplate(false)} className="hover:underline">Template Details</button>
                <span className="mx-1">/</span>
                <span className="text-foreground font-medium">Use Template</span>
              </nav>
              <span className="text-xs font-medium text-muted-foreground/90 truncate max-w-[360px]" title={data?.name}>{data?.name}</span>
            </div>
          </div>
          <BrandLogo className="h-14 w-auto" />
          <div className="flex items-center gap-3 text-[10px]">
            <span className="px-2 py-1 rounded-full border bg-muted/40 text-muted-foreground">Sequential: {data?.isSequentialSigning ? 'Yes' : 'No'}</span>
            <span className="px-2 py-1 rounded-full border bg-muted/40 text-muted-foreground">Recipients: {data?.totalRecipients ?? 0}</span>
            <span className="px-2 py-1 rounded-full border bg-muted/40 text-muted-foreground">Fields: {data?.totalFields ?? 0}</span>
          </div>
        </div>
        <div className="pt-16 pb-8 px-4 md:px-6">
          <div className="rounded-lg border border-border bg-card/80 backdrop-blur-sm shadow-sm p-2">
            {/* Inject common fields globally so SendForSignaturePage can pick them up */}
            {typeof window !== 'undefined' && (
              <script
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: `window.__TEMPLATE_COMMON_FIELDS__ = ${(JSON.stringify((data?.documents||[]).flatMap(d => d.commonFields || [])))};` }}
              />
            )}
            <SendForSignaturePage
              modeOverride="use-template"
              templateId={String(templateId)}
              onCancelEmbed={() => setStartUseTemplate(false)}
              commonFieldsOverride={(data?.documents || []).flatMap(d => d.commonFields || [])}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 flex items-center justify-between px-6 h-16 border-b border-border bg-background/95 backdrop-blur z-50">
        <div className="flex items-center gap-4">
          <BackButton ariaLabel="Back" onClick={() => router.push('/')} size="sm" />
          <div className="flex flex-col">
            <span className="text-base font-semibold tracking-tight">Template Details</span>
            <span className="text-[11px] text-muted-foreground truncate max-w-[240px]">{data.name}</span>
          </div>
        </div>
        <BrandLogo className="h-16 w-auto" />
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground">Sequential Signing: {data.isSequentialSigning ? 'Yes' : 'No'}</span>
          <Button
            variant="default"
            size="sm"
            className="ml-2 h-8 px-3 flex items-center gap-1"
            onClick={() => setStartUseTemplate(true)}
            aria-label="Use this template"
          >
            <Layers className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium">Use Template</span>
          </Button>
        </div>
      </div>
      {/* Main Grid */}
      <div className="pt-20 px-6 pb-10 w-full max-w-[1700px] mx-auto flex flex-col gap-8">
          <div className="grid grid-cols-1 xl:grid-cols-[480px_1fr] gap-8">
            {/* Left: Template + Owner Details */}
            <div className="flex flex-col gap-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
                <div className="rounded-xl border bg-gradient-to-br from-primary/5 to-primary/10 p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><FileText className="h-3.5 w-3.5" />Documents</span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 font-medium">{totals.docs === 1 ? 'Single' : 'Multi'}</span>
                  </div>
                  <span className="text-2xl font-semibold">{totals.docs}</span>
                </div>
                <div className="rounded-xl border bg-gradient-to-br from-purple-500/5 to-purple-500/10 p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Users className="h-3.5 w-3.5" />Recipients</span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20 font-medium">{totals.recips === 0 ? 'None' : totals.recips === 1 ? 'Single' : 'Multiple'}</span>
                  </div>
                  <span className="text-2xl font-semibold">{totals.recips}</span>
                </div>
                <div className="rounded-xl border bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><ListChecks className="h-3.5 w-3.5" />Fields</span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 font-medium">{totals.fields === 0 ? 'None' : `${totals.fields}`}</span>
                  </div>
                  <span className="text-2xl font-semibold">{totals.fields}</span>
                </div>
                <div className="rounded-xl border bg-gradient-to-br from-amber-500/5 to-amber-500/10 p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" />Files</span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 font-medium">{totals.files === 0 ? 'None' : `${totals.files}`}</span>
                  </div>
                  <span className="text-2xl font-semibold">{totals.files}</span>
                </div>
              </div>
              <Card className="p-5 flex flex-col gap-2 border bg-background/80 backdrop-blur">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><User className="h-3.5 w-3.5" />Owner</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate" title={data.ownerName}>{data.ownerName}</span>
                  {data.ownerRole && data.ownerRole !== '-' && (
                    <Badge variant={data.ownerRole === 'Admin' ? 'default' : 'secondary'} className="text-[10px] px-2 py-0.5">{data.ownerRole}</Badge>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground truncate" title={data.ownerEmail}>{data.ownerEmail}</span>
              </Card>
              <Card className="p-5 flex flex-col gap-3 border bg-background/80 backdrop-blur">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Info className="h-3.5 w-3.5" />Description</span>
                  <p className="text-[12px] leading-relaxed text-muted-foreground whitespace-pre-line">{data.description}</p>
                </div>
                <Separator className="bg-border/60 h-px" />
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div className="flex flex-col"><span className="text-muted-foreground">Created</span><span className="font-medium">{formatDateDDMMYYYY(data.createdOn)}</span></div>
                  <div className="flex flex-col"><span className="text-muted-foreground">Signing</span><span className="font-medium">{data.isSequentialSigning ? 'Sequential' : 'Parallel'}</span></div>
                </div>
              </Card>
              <Card className="p-5 flex flex-col gap-3 border bg-background/80 backdrop-blur">
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><Bookmark className="h-3.5 w-3.5" />Legend</span>
                <div className="flex flex-wrap gap-2">
                  {['Signature','Date','Text'].map(l => (
                    <span key={l} className="px-2 py-1 rounded-md border bg-muted/30 text-[11px] text-muted-foreground">{l}</span>
                  ))}
                </div>
              </Card>
            </div>
            {/* Right: Compact Viewer */}
            <Card className="p-4 border border-border/60 shadow-sm bg-background/70 backdrop-blur-sm flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-medium flex items-center gap-2"><FileText className="h-4 w-4" />Document Preview</span>
                  <span className="text-[11px] text-muted-foreground">Compact embedded view</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(z => Math.max(0.5, +(z-0.1).toFixed(2)))}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md border bg-background hover:bg-muted transition"
                    title="Zoom Out"
                    aria-label="Zoom Out"
                  >
                    <span className="text-xs font-medium">-</span>
                  </button>
                  <div className="h-8 px-2 min-w-[44px] inline-flex items-center justify-center rounded-md border bg-background text-[11px] font-medium" title="Zoom Level">{Math.round(previewZoom*100)}%</div>
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(z => Math.min(2.5, +(z+0.1).toFixed(2)))}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-md border bg-background hover:bg-muted transition"
                    title="Zoom In"
                    aria-label="Zoom In"
                  >
                    <span className="text-xs font-medium">+</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(1)}
                    className="h-8 px-3 inline-flex items-center justify-center rounded-md border bg-background hover:bg-muted transition"
                    title="Reset Zoom"
                    aria-label="Reset Zoom"
                  >
                    <span className="text-[11px] font-medium">Reset</span>
                  </button>
                </div>
              </div>
              <div className="rounded-lg border bg-muted/20">
                  <DocumentFieldMapper
                    pdfUrl={pdfUrl || 'data:application/pdf;base64,JVBERi0xLjUKJeLjz9MKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFsgMyAwIFIgXSAvQ291bnQgMSA+PgplbmRvYmoKMyAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIC9Db250ZW50cyA0IDAgUiA+PgplbmRvYmoKNCAwIG9iago8PCAvTGVuZ3RoIDUgMCBSID4+CnN0cmVhbQplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKMTAKZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMTAgMDAwMDAgbiAKMDAwMDAwMDYxIDAwMDAwIG4gCjAwMDAwMDA5NiAwMDAwMCBuIAowMDAwMDAxNzMgMDAwMDAgbiAKMDAwMDAwMTk0IDAwMDAwIG4gCnRyYWlsZXIKPDwgL1Jvb3QgMSAwIFIgL1NpemUgNiA+PgpzdGFydHhyZWYKMjExCiUlRU9G'}
                    recipients={recipientColorMap}
                    hasHeaderBar
                    readOnly
                    compact
                    zoom={previewZoom}
                    onZoomChange={setPreviewZoom}
                    hideInternalZoomControls
                    presetFields={presetFields}
                    debug={debug}
                    showRecipientFilterDock
                    allowRecipientFilteringInReadOnly
                    hideReadOnlyRecipientPanel
                  />
              </div>
            </Card>
          </div>
          {/* Recipients Section below both */}
          <div className="flex flex-col gap-6">
            {data.documents.map(doc => (
              <Card key={doc.id ?? doc.name} className="p-5 flex flex-col gap-5 border border-border/60 bg-background/80 backdrop-blur-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex flex-col">
                    <h3 className="text-lg font-semibold tracking-tight">{doc.name}</h3>
                    <span className="text-[11px] text-muted-foreground">Files: {doc.files.length} • Recipients: {doc.recipients.length}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="px-2 py-1 rounded border bg-muted/30">Order {doc.order ?? 1}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Recipients</span>
                  {doc.recipients.length === 0 ? <div className="text-xs text-muted-foreground">No recipients</div> : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {/* Common Fields Card (aggregated) */}
                      {!data.isSequentialSigning && doc.commonFields && doc.commonFields.length > 0 && (() => {
                        const commonColor = recipientColorMap.find(rc => rc.id === '__COMMON__')?.color || '#6b7280';
                        return (
                          <div key="__COMMON_CARD__" className="p-4 rounded-xl border bg-card/70 backdrop-blur flex flex-col gap-3 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex flex-col">
                                <span className="font-medium leading-tight flex items-center gap-2">
                                  <span className="inline-flex w-4 h-4 rounded-full" style={{ background: commonColor }} />
                                  Shared
                                </span>
                                <span className="text-[10px] text-muted-foreground">Common Fields</span>
                              </div>
                              <span className="text-[10px] px-2 py-1 rounded-full border bg-muted/30 text-muted-foreground" title="Shared Fields">Shared</span>
                            </div>
                            <div className="flex flex-col gap-2">
                              <span className="text-[9px] uppercase tracking-wide text-muted-foreground">Fields ({doc.commonFields.length})</span>
                              <div className="flex flex-wrap gap-1">
                                {doc.commonFields.map(fField => (
                                  <span key={fField.id ?? fField.key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px]" style={{ background: commonColor + '1A', borderColor: commonColor }} title={fField.key}>{fField.key}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                      {doc.recipients.map(r => (
                        <div key={r.id ?? r.defaultUserEmail} className="p-4 rounded-xl border bg-card/70 backdrop-blur flex flex-col gap-3 shadow-sm">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex flex-col">
                              <span className="font-medium leading-tight flex items-center gap-2">
                                <span className="inline-flex w-4 h-4 rounded-full" style={{ background: recipientColorMap.find(rc => rc.email === r.defaultUserEmail)?.color || 'var(--primary)' }} />
                                {r.defaultUserName}
                              </span>
                              <span className="text-[10px] text-muted-foreground">{r.defaultUserEmail}</span>
                            </div>
                            <span className="text-[10px] px-2 py-1 rounded-full border bg-muted/40 text-muted-foreground" title={r.roleName}>{r.roleName}</span>
                          </div>
                          {r.fields.filter(f => !f.isCommonField).length > 0 && (
                            <div className="flex flex-col gap-2">
                              <span className="text-[9px] uppercase tracking-wide text-muted-foreground">Fields ({r.fields.filter(f => !f.isCommonField).length})</span>
                              <div className="flex flex-wrap gap-1">
                                {r.fields.filter(f => !f.isCommonField).map(fField => (
                                  <span key={fField.id ?? fField.key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/40 border text-[10px] text-muted-foreground" title={fField.key}>{fField.key}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
    </>
  );
};

export default TemplateDetailsProfessionalPage;