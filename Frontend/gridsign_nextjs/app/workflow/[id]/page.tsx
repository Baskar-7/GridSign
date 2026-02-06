"use client";
// Clean rebuilt workflow details page with single unified progress bar and recipients on the right.
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useApiQuery } from '@/hooks/useApiQuery';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import WorkflowDetailsDashboard from '@/components/workflows/WorkflowDetailsDashboard';
import { durationBetween, formatDateTime } from '@/lib/utils';
// Inline SVG Icons
const EyeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" {...props}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12Z"/><circle cx="12" cy="12" r="3"/></svg>
);
const DownloadIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" {...props}><path d="M12 3v14"/><path d="m6 11 6 6 6-6"/><path d="M5 21h14"/></svg>
);
const CloseIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" {...props}><path d="M18 6 6 18"/><path d="M6 6l12 12"/></svg>
);
const FileIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" {...props}><path d="M4 3h10l6 6v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"/><path d="M14 3v6h6"/></svg>
);
const BellIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" {...props}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.7 1.7 0 0 0 3.4 0"/></svg>
);
const SendIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" {...props}><path d="M3 3l18 9-18 9 4-9Z"/><path d="M13 12H7"/></svg>
);
// Stat card icons
const UsersIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.85"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);
const CheckIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" {...props}><path d="M20 6 9 17l-5-5"/></svg>
);
const ClockIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" {...props}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
);
const FlowIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" {...props}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M10 7h4"/><path d="M17 10v4"/><path d="M7 10v4"/><path d="M10 17h4"/></svg>
);
// Broadcast / bulk reminder icon (bell with outward waves)
const BroadcastIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" {...props}>
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
    <path d="M10.3 21a1.7 1.7 0 0 0 3.4 0" />
    <path d="M2 8c0-5 5-7 10-7s10 2 10 7" strokeWidth={1} />
    <path d="M4 8c0-3 4-5 8-5s8 2 8 5" strokeWidth={1} />
  </svg>
);
// Unified Back icon (reuse style from file resource viewer)
const BackIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" {...props}><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
);
// Refresh icon (consistent with file resource viewer)
const RefreshIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" {...props}><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6l3 2"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6l-3-2"/></svg>
);
// Left column metric icons
const CalendarIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" {...props}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
);
const UpdateIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" {...props}><path d="M21 12a9 9 0 1 1-2.64-6.36L21 7"/><path d="M21 3v4h-4"/><path d="M12 7v5l3 3"/></svg>
);
const ExpiryIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" {...props}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
);
const TimerIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3" {...props}><rect x="6" y="2" width="12" height="5" rx="1"/><path d="M12 14V8"/><path d="M9.5 16.5 12 14l2.5 2.5"/><circle cx="12" cy="14" r="8"/></svg>
);

// Reusable enhanced progress bar component
interface EnhancedProgressBarProps {
  value: number; // 0-100
  signedLabel: string;
  envelopeLabel?: string;
  envelopePct?: number;
  loading?: boolean;
  compact?: boolean; // minimized visual style
}

const EnhancedProgressBar: React.FC<EnhancedProgressBarProps> = ({ value, signedLabel, envelopeLabel, envelopePct, loading, compact }) => {
  // Force a 10px height as requested (compact visual). Text remains centered; consider moving text above if readability is an issue.
  const barHeightClass = 'h-[10px]';
  return (
    <div className="group" title={`${value}% overall completion`}>
      <div className="flex items-center gap-3">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={value}
          aria-label="Workflow completion"
          className="relative h-[10px] flex-1 rounded-md border border-border/40 bg-muted/60 overflow-hidden shadow-sm"
        >
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-teal-500 via-cyan-500 to-sky-500 animate-[progress-gradient_8s_linear_infinite] [background-size:250%] transition-all duration-500 ease-out"
            style={{ width: `${value}%` }}
          />
        </div>
        <div className="flex items-center gap-1 min-w-[52px] justify-end text-right">
          <span className="text-[11px] font-semibold text-foreground">{value}%</span>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-teal-500" /> {signedLabel}</span>
        {envelopePct != null && envelopeLabel && (
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-cyan-500" /> {envelopeLabel} {envelopePct}%</span>
        )}
        {loading && <span className="animate-pulse">Updating…</span>}
      </div>
    </div>
  );
};
import {
  WorkflowDetailsDto,
  WorkflowProgressDto,
  WorkflowRecipientDetailsDto,
  WorkflowEmbeddedProgressDto,
  SignedDocumentDetailsDto,
  SignedDocumentVersionDto,
  WorkflowRecipientSignatureDetailsDto
} from '@/types/api';

// Mapping utilities
const mapWorkflowStatus = (n: number): string => {
  switch (n) {
    case 0: return 'None';
    case 1: return 'Draft';
    case 2: return 'In Progress';
    case 3: return 'Completed';
    case 4: return 'Expired';
    case 5: return 'Cancelled';
    default: return 'Unknown';
  }
};
const mapRecipientConfiguration = (n: number): string => {
  switch (n) {
    case 0: return 'FromTemplate';
    case 1: return 'CustomRecipients';
    case 2: return 'Mixed';
    case 3: return 'CreateNewTemplate';
    default: return 'Unknown';
  }
};
// Updated backend enum: Draft=0, InProgress=1, Completed=2, Failed=3, Expired=4
const mapEnvelopeStatusRaw = (n: number | undefined): 'Draft' | 'InProgress' | 'Completed' | 'Failed' | 'Expired' | 'Unknown' => {
  switch (n) {
    case 0: return 'Draft';
    case 1: return 'InProgress';
    case 2: return 'Completed';
    case 3: return 'Failed';
    case 4: return 'Expired';
    default: return 'Unknown';
  }
};

// Display variant for envelope status (human friendly)
const mapEnvelopeStatusDisplay = (raw: ReturnType<typeof mapEnvelopeStatusRaw>): string => {
  switch (raw) {
    case 'InProgress': return 'Sent'; // show Sent instead of InProgress
    default: return raw;
  }
};

// Recipient status derived from envelope status
const deriveRecipientStatus = (raw: ReturnType<typeof mapEnvelopeStatusRaw>, hasSigned: boolean): string => {
  if (hasSigned) return 'Signed';
  switch (raw) {
    case 'Draft': return 'Draft';
    case 'InProgress': return 'In Progress';
    case 'Failed': return 'Failed';
    case 'Completed': return 'Completed';
    case 'Expired': return 'Expired';
    default: return 'Unknown';
  }
};

// Invitation badge (simplified copy) based on raw + signed
const invitationState = (rawStatus: number | undefined, hasSigned: boolean): { label: string; tone: string } => {
  const raw = mapEnvelopeStatusRaw(rawStatus);
  if (hasSigned) return { label: 'Signed', tone: 'bg-green-500/15 text-green-700 border-green-400/50' };
  switch (raw) {
    case 'Draft': return { label: 'Draft', tone: 'bg-neutral-500/10 text-neutral-700 border-neutral-400/40' };
    case 'InProgress': return { label: 'Sent', tone: 'bg-blue-500/10 text-blue-700 border-blue-400/40' };
    case 'Failed': return { label: 'Failed', tone: 'bg-red-500/15 text-red-700 border-red-400/50' };
    case 'Completed': return { label: 'Completed', tone: 'bg-green-500/15 text-green-700 border-green-400/50' }; // already finished
    case 'Expired': return { label: 'Expired', tone: 'bg-amber-500/15 text-amber-700 border-amber-400/40' };
    default: return { label: 'Unknown', tone: 'bg-neutral-500/10 text-neutral-700 border-neutral-400/40' };
  }
};
// Human-readable description for each envelope status (per recipient perspective)
const envelopeStatusDescription = (rawStatus: number | undefined, hasSigned: boolean): string => {
  const raw = mapEnvelopeStatusRaw(rawStatus);
  if (hasSigned) return 'Recipient has signed; no further action needed.';
  switch (raw) {
    case 'Draft': return 'Envelope prepared but not yet dispatched.';
    case 'InProgress': return 'Invitation sent; awaiting recipient signature.';
    case 'Failed': return 'Delivery failed; please retry sending the envelope.';
    case 'Completed': return 'Envelope lifecycle finished; signature sync pending or already recorded.';
    case 'Expired': return 'Envelope validity expired; resend or extend to proceed.';
    default: return 'Status unknown; please verify.';
  }
};
const mapEmailStatus = (n: number): string => {
  switch (n) {
    case 0: return 'None';
    case 1: return 'Pending';
    case 2: return 'Sent';
    case 3: return 'Delivered';
    case 4: return 'Bounced';
    case 5: return 'Failed';
    default: return 'Unknown';
  }
};
// DeliveryType enum per backend:
// 0 => NeedsToSign, 1 => ReceivesACopy
const mapDeliveryType = (n: number): string => {
  switch (n) {
    case 0: return 'Needs To Sign';
    case 1: return 'Receives A Copy';
    default: return 'Unknown';
  }
};
const statusColorToken = (s: string): string => {
  switch (s) {
    case 'Draft': return 'bg-amber-500/10 text-amber-700 border-amber-400/40';
    case 'In Progress': return 'bg-blue-500/10 text-blue-700 border-blue-400/40';
    case 'Completed': return 'bg-green-500/15 text-green-700 border-green-400/50';
    case 'Expired': return 'bg-neutral-500/10 text-neutral-700 border-neutral-400/40';
    case 'Cancelled': return 'bg-red-500/10 text-red-700 border-red-400/40';
    default: return 'bg-muted/60 text-muted-foreground border-border/50';
  }
};

// Helper to unwrap ReferenceHandler.Preserve arrays
const unwrapValues = <T,>(val: unknown): T[] => {
  if (val == null) return [];
  if (Array.isArray(val)) return val as T[];
  if (typeof val === 'object') {
    const obj = val as { $values?: unknown };
    if (Array.isArray(obj.$values)) return obj.$values as T[];
    return Object.values(obj as Record<string, T>);
  }
  return [];
};

const WorkflowDetailsPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const rawId = params?.id as string | undefined;
  const workflowId = rawId?.replace('wf-','');
  const API_BASE = process.env.NEXT_PUBLIC_LOCAL_API_URL?.replace(/\/$/, '') || 'http://localhost:5035/api';
  // Refactored: Use FileResource directly (GetFileResource) via FileResourceId embedded in version DTOs
  const buildFileResourceUrl = (fileResourceId: number) => `${API_BASE}/FileResource/${fileResourceId}`; // direct API endpoint
  // (Modal preview removed per request – keep state in case of future re-enable)
  const [pdfPreviewUrl,setPdfPreviewUrl] = useState<string|null>(null);
  const [pdfPreviewOpen,setPdfPreviewOpen] = useState(false);
  const [previewContentType,setPreviewContentType] = useState<string|null>(null);
  // Resolve fileResourceId given signature versions and latestVersionNumber; if absent, cross-reference documents collection.
  const resolveLatestFileResourceId = (
    versions: SignedDocumentVersionDto[] | any,
    latestVersionNumber: number,
    signedDocumentId?: number,
    allDocuments?: SignedDocumentDetailsDto[]
  ): number | null => {
    // Normalize $values wrapper or object map into an array of version objects
    const normalizeVersions = (input: any): any[] => {
      if (!input) return [];
      if (Array.isArray(input)) return input;
      if (typeof input === 'object') {
        if (Array.isArray(input.$values)) return input.$values;
        return Object.values(input);
      }
      return [];
    };
    const scanPickId = (v: any) => {
      if (!v || typeof v !== 'object') return null;
      // Common casing variants
      if (typeof v.fileResourceId === 'number') return v.fileResourceId;
      if (typeof v.FileResourceId === 'number') return v.FileResourceId;
      // Generic key scan (case-insensitive)
      for (const k of Object.keys(v)) {
        if (k.toLowerCase() === 'fileresourceid' && typeof (v as any)[k] === 'number') return (v as any)[k];
      }
      return null;
    };
    const normalized = normalizeVersions(versions);
    if (normalized.length > 0) {
      // Prefer exact version match
      const exact = normalized.find(v => v.versionNumber === latestVersionNumber && scanPickId(v) != null);
      if (exact) return scanPickId(exact);
      // Fallback: highest version with an id
      const sorted = [...normalized].sort((a,b)=> (b?.versionNumber ?? 0) - (a?.versionNumber ?? 0));
      const fallback = sorted.find(v => scanPickId(v) != null);
      if (fallback) return scanPickId(fallback);
    }
    // Cross-reference documents collection when direct versions lacked id
    if (signedDocumentId && Array.isArray(allDocuments)) {
      const doc = allDocuments.find(d => d.signedDocumentId === signedDocumentId);
      if (doc) {
        const docNormalized = normalizeVersions(doc.versions);
        if (docNormalized.length) {
          const match = docNormalized.find(v => v.versionNumber === latestVersionNumber && scanPickId(v) != null);
            if (match) return scanPickId(match);
          const sortedDoc = [...docNormalized].sort((a,b)=> (b?.versionNumber ?? 0) - (a?.versionNumber ?? 0));
          const withId = sortedDoc.find(v => scanPickId(v) != null);
          if (withId) return scanPickId(withId);
        }
      }
    }
    return null;
  };
  // New unified "View" behavior: open file resource in a new tab (no inline modal per request)
  const viewFileResourceNewTab = (fileResourceId: number, workflowId?: string | null) => {
    if (!fileResourceId || fileResourceId <= 0) { toast.error('Invalid file id'); return; }
    openFileResourceViewerPage(fileResourceId, workflowId);
  };

  // Download without page reload: fetch blob then trigger browser save
  const downloadFileResource = async (fileResourceId: number) => {
    if (!fileResourceId || fileResourceId <= 0) { toast.error('Invalid file id'); return; }
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const url = buildFileResourceUrl(fileResourceId);
      const resp = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!resp.ok) { toast.error(`Download failed (${resp.status})`); return; }
      const ct = resp.headers.get('Content-Type') || 'application/octet-stream';
      const buf = await resp.arrayBuffer();
      const blob = new Blob([buf], { type: ct });
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      // Attempt filename from content-disposition header
      const cd = resp.headers.get('Content-Disposition');
      let filename = `file-${fileResourceId}`;
      if (cd && /filename=([^;]+)/i.test(cd)) {
        filename = decodeURIComponent(/filename=([^;]+)/i.exec(cd)![1].replace(/"/g,''));
      }
      a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=> URL.revokeObjectURL(objUrl), 10_000);
    } catch (e:any) {
      toast.error(e.message || 'Download error');
    }
  };
  const openFileResourceViewerPage = (fileResourceId: number, workflowId?: string | null) => {
    if (!fileResourceId) { toast.error('Missing file id'); return; }
    const wfParam = workflowId ? `?workflowId=${workflowId}` : '';
    try { window.open(`/file-resource/${fileResourceId}${wfParam}`, '_blank','noopener,noreferrer'); } catch { toast.error('Popup blocked'); }
  };
  const closePdfPreview = () => {
    setPdfPreviewOpen(false);
    setPdfPreviewUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
    setPreviewContentType(null);
  };
  const openInNewTab = (url: string) => {
    try { window.open(url, '_blank', 'noopener,noreferrer'); } catch { toast.error('Popup blocked'); }
  };
  const downloadFile = (url: string) => {
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = '';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e:any) {
      toast.error(e.message || 'Download failed');
    }
  };
  const [mounted, setMounted] = useState(false);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
    try { tokenRef.current = localStorage.getItem('token'); } catch {}
  }, []);

  const detailsQuery = useApiQuery<WorkflowDetailsDto>({
    queryKey: ['workflow-details', workflowId],
    url: `${API_BASE}/workflow/getWorkflowsDetails?workflowId=${workflowId ?? ''}`,
    method: 'GET',
    enabled: mounted && !!workflowId && !!tokenRef.current,
    staleTime: 15_000,
  });
  const data = detailsQuery.data?.data;
  // Sequential signing flag (now directly provided in DTO if backend extended)
  const isSequentialSigningEnabled: boolean | undefined = data?.isSequentialSigningEnabled;

  const progressQuery = useApiQuery<WorkflowProgressDto>({
    queryKey: ['workflow-progress', workflowId],
    url: `${API_BASE}/workflow/getProgress?workflowId=${workflowId ?? ''}`,
    method: 'GET',
    enabled: !!workflowId && !!tokenRef.current,
    staleTime: 15_000,
  });

  if (detailsQuery.error && detailsQuery.error.response?.status === 401) {
    toast.error('Session expired');
    if (typeof window !== 'undefined') setTimeout(()=> router.push('/signin'), 500);
  }

  const recipients: WorkflowRecipientDetailsDto[] = unwrapValues<WorkflowRecipientDetailsDto>(data?.recipients);
  const documents: SignedDocumentDetailsDto[] = unwrapValues<SignedDocumentDetailsDto>(data?.documents);
  const embedded: WorkflowEmbeddedProgressDto | undefined = data?.progress;

  const totalRecipients = embedded?.totalRecipients ?? recipients.length;
  const signedRecipients = embedded?.signedRecipients ?? recipients.filter(r => r.hasSigned).length;
  const signaturePct = embedded?.signatureProgressPct != null ? Math.round(embedded.signatureProgressPct) : (totalRecipients === 0 ? 0 : Math.round((signedRecipients / totalRecipients) * 100));
  const overallPct = embedded?.overallProgressPct != null ? Math.round(embedded.overallProgressPct) : signaturePct;
  const envelopePct = embedded?.envelopeProgressPct != null ? Math.round(embedded.envelopeProgressPct) : undefined;

  const templateCount = recipients.filter(r => r.useDefaultUser).length;
  const customCount = recipients.length - templateCount;
  // Template / creator metadata from DTO
  const templateId = data?.templateId;
  const templateName = data?.templateName;
  const templateDescription = data?.templateDescription;
  const templateCreatedOn = data?.templateCreatedOn;
  const creatorId = data?.workFlowCreatorId;
  const ownerEmail = data?.workflowOwnerEmail;
  const daysRemaining = useMemo(() => {
    if (!data?.validUntil) return 0;
    const target = new Date(data.validUntil).getTime();
    return Math.max(0, Math.ceil((target - Date.now()) / 86400000));
  }, [data?.validUntil]);

  const recipientConfig = data?.recipientConfiguration;
  // Prefetch template details page when templateId is known to speed up navigation.
  useEffect(() => {
    if (mounted && templateId) {
      try { router.prefetch(`/template-details/${templateId}`); } catch {}
    }
  }, [mounted, templateId, router]);
  const [showTemplate, setShowTemplate] = useState(true);
  const [showCustom, setShowCustom] = useState(true);
  const [expandedRecipient, setExpandedRecipient] = useState<number | null>(null);
  // Simplified modal animation state
  const [modalVisible, setModalVisible] = useState(false);
  const [modalActive, setModalActive] = useState(false); // triggers animation
  const openRecipientsModal = () => {
    setModalVisible(true);
    requestAnimationFrame(()=> setModalActive(true));
  };
  const closeRecipientsModal = () => {
    setModalActive(false);
    setTimeout(()=> setModalVisible(false), 420); // allow animation to finish
  };
  // New filter controls
  const [recipientSearch, setRecipientSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'signed' | 'pending' | 'failed' | 'expired' | 'draft' | 'sent'>('all');
  const [remindLoading, setRemindLoading] = useState<Record<number, boolean>>({});
  const [bulkRemindLoading, setBulkRemindLoading] = useState(false);
  const normalizedSearch = recipientSearch.trim().toLowerCase();
  const filteredRecipients = recipients.filter(r => {
    // template/custom filter
    if (r.useDefaultUser && !showTemplate) return false;
    if (!r.useDefaultUser && !showCustom) return false;
    // search filter
    if (normalizedSearch) {
      const hay = (r.displayName || '').toLowerCase();
      if (!hay.includes(normalizedSearch)) return false;
    }
    // status filter
    if (statusFilter !== 'all') {
      const raw = mapEnvelopeStatusRaw(r.envelopeStatus);
      const invite = invitationState(r.envelopeStatus, r.hasSigned);
      switch (statusFilter) {
        case 'signed': if (!r.hasSigned) return false; break;
        case 'pending': if (r.hasSigned || !(raw === 'InProgress' || raw === 'Completed' || raw === 'Draft')) return false; break; // actionable statuses
        case 'failed': if (raw !== 'Failed') return false; break;
        case 'expired': if (raw !== 'Expired') return false; break;
        case 'draft': if (invite.label !== 'Draft') return false; break;
        case 'sent': if (invite.label !== 'Sent') return false; break;
      }
    }
    return true;
  });

  // Derive effective workflow status: if past validUntil or any envelope expired,
  // show Expired unless already Completed or Cancelled.
  const rawWorkflowStatus = data ? mapWorkflowStatus(data.status) : 'None';
  const pastDue = useMemo(() => {
    if (!data?.validUntil) return false;
    return new Date(data.validUntil).getTime() < Date.now();
  }, [data?.validUntil]);
  const anyEnvelopeExpired = useMemo(() => {
    return recipients.some(r => mapEnvelopeStatusRaw(r.envelopeStatus) === 'Expired');
  }, [recipients]);
  const workflowStatus = useMemo(() => {
    if (rawWorkflowStatus === 'Completed' || rawWorkflowStatus === 'Cancelled') return rawWorkflowStatus;
    if (pastDue || anyEnvelopeExpired) return 'Expired';
    return rawWorkflowStatus;
  }, [rawWorkflowStatus, pastDue, anyEnvelopeExpired]);

  // Only stat summary cards use color gradients now.
  const statCardGradients = [
    'bg-gradient-to-br from-purple-600/15 via-purple-500/10 to-indigo-500/15 border-purple-400/40',
    'bg-gradient-to-br from-emerald-600/15 via-teal-500/10 to-cyan-500/15 border-emerald-400/40',
    'bg-gradient-to-br from-amber-600/15 via-orange-500/10 to-yellow-500/15 border-amber-400/40',
    'bg-gradient-to-br from-pink-600/15 via-rose-500/10 to-red-500/15 border-pink-400/40'
  ];

  return (
    <>
    <WorkflowDetailsDashboard>
      {/* Top bar */}
      <div className="sticky top-0 z-30 h-16 bg-background/95 backdrop-blur border-b border-border/40 flex items-center justify-between px-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={()=> router.back()}
            aria-label="Go Back"
            className="p-2 rounded-md border bg-muted/50 hover:bg-muted/70 transition-colors flex items-center justify-center"
          >
            <BackIcon />
          </button>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold truncate max-w-[300px]" title={data?.workflowName || 'Workflow'}>{data?.workflowName || 'Workflow'}</span>
            <span className="text-[10px] text-muted-foreground">ID: {workflowId || 'N/A'}</span>
          </div>
          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-border/40">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Status</span>
            <span className={`px-2 py-1 rounded-full text-[10px] font-medium border ${statusColorToken(workflowStatus)}`}>{workflowStatus}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={detailsQuery.isLoading} onClick={()=> detailsQuery.refetch()} className="gap-1"><RefreshIcon /> {detailsQuery.isLoading ? 'Refreshing…':'Refresh'}</Button>
        </div>
      </div>

      {/* Stat summary (includes Sequential Signing) */}
      {mounted && !detailsQuery.isLoading && data && (
        <div className="flex flex-wrap gap-3 px-6 pt-4">
          <div className={`p-3 rounded-md border flex flex-col flex-1 min-w-[160px] ${statCardGradients[0]}`}>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><UsersIcon /> Recipients</span>
            <span className="text-sm font-semibold">{totalRecipients}</span>
            <span className="text-[10px] text-muted-foreground">{templateCount} template · {customCount} custom</span>
          </div>
          <div className={`p-3 rounded-md border flex flex-col flex-1 min-w-[160px] ${statCardGradients[1]}`}>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><CheckIcon /> Signed</span>
            <span className="text-sm font-semibold">{signedRecipients}</span>
            <span className="text-[10px] text-muted-foreground">{signaturePct}% complete</span>
          </div>
          <div className={`p-3 rounded-md border flex flex-col flex-1 min-w-[160px] ${statCardGradients[2]}`}>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><ClockIcon /> Reminder Interval</span>
            <span className="text-sm font-semibold">{data.reminderIntervalInDays}d</span>
            <span className="text-[10px] text-muted-foreground">config: {mapRecipientConfiguration(data.recipientConfiguration)}</span>
          </div>
          <div className={`p-3 rounded-md border flex flex-col flex-1 min-w-[160px] ${statCardGradients[3]}`}>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><FlowIcon /> Sequential Signing</span>
            <span className="text-sm font-semibold">{isSequentialSigningEnabled === undefined ? 'Unknown' : (isSequentialSigningEnabled ? 'Enabled' : 'Disabled')}</span>
            <span className="text-[10px] text-muted-foreground">enforced recipient order</span>
          </div>
        </div>
      )}

      {/* Enhanced unified progress bar */}
      {mounted && !detailsQuery.isLoading && data && (
        <div className="px-6 pt-4">
          <EnhancedProgressBar
            value={overallPct}
            signedLabel={`Signed ${signedRecipients}/${totalRecipients}`}
            envelopeLabel="Envelopes"
            envelopePct={envelopePct}
            loading={progressQuery.isLoading}
            compact
          />
        </div>
      )}

      <div className={`flex-1 flex flex-col lg:flex-row overflow-hidden`}>
        {/* Left column always visible (modal used instead of max view) */}
        <div className="lg:w-[50%] xl:w-[55%] flex flex-col p-6 gap-6 overflow-auto border-r border-border/40">
          {(!mounted || detailsQuery.isLoading) && (
            <div className="space-y-3" aria-label="Loading workflow details">{[...Array(5)].map((_,i)=> <div key={i} className="h-10 rounded-md border bg-muted/40 animate-pulse" />)}</div>
          )}
          {mounted && !detailsQuery.isLoading && !detailsQuery.error && data && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-2 rounded-md border bg-background/70 flex flex-col"><span className="text-[9px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><CalendarIcon /> Created</span><span className="text-[11px] font-medium" title={data.createdAtUtc}>{formatDateTime(data.createdAtUtc)}</span></div>
                <div className="p-2 rounded-md border bg-background/70 flex flex-col"><span className="text-[9px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><UpdateIcon /> Updated</span><span className="text-[11px] font-medium" title={data.lastUpdatedUtc}>{formatDateTime(data.lastUpdatedUtc)}</span></div>
                <div className="p-2 rounded-md border bg-background/70 flex flex-col"><span className="text-[9px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><ExpiryIcon /> Valid Until</span><span className="text-[11px] font-medium" title={data.validUntil}>{formatDateTime(data.validUntil)}</span></div>
                <div className="p-2 rounded-md border bg-background/70 flex flex-col"><span className="text-[9px] uppercase tracking-wide text-muted-foreground flex items-center gap-1"><TimerIcon /> Days Remaining</span><span className="text-[11px] font-medium" title={`Days until expiry (${daysRemaining})`}>{daysRemaining}</span></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Owner card (shrunk) */}
                <div className="p-3 rounded-md border bg-background/70 flex flex-col justify-between gap-1 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Owner</h2>
                    <span className="text-[10px] px-2 py-1 rounded-full border bg-muted/50">Workflow</span>
                  </div>
                  {(() => {
                    const ownerNameRaw = data.workflowOwnerName?.trim();
                    const ownerEmailRaw = ownerEmail?.trim();
                    // Prefer explicit owner name; otherwise derive from email local-part; do NOT fallback to recipient
                    const derivedNameFromEmail = ownerEmailRaw ? ownerEmailRaw.split('@')[0].replace(/[-_.]+/g,' ').replace(/\b\w/g, c => c.toUpperCase()) : undefined;
                    const finalOwnerName = ownerNameRaw && ownerNameRaw.length > 0
                      ? ownerNameRaw
                      : (derivedNameFromEmail || '—');
                    return (
                      <div className="text-xs font-medium truncate" title={finalOwnerName}>{finalOwnerName}</div>
                    );
                  })()}
                  <div className="text-[9px] text-muted-foreground">Workflow ID: {workflowId || 'N/A'}</div>
                  <div className="text-[9px] text-muted-foreground">Creator ID: {creatorId ?? 'N/A'}</div>
                  <div className="text-[9px] text-muted-foreground">Owner Email: {ownerEmail ?? 'Not Provided'}</div>
                </div>
                {/* Template card */}
                <div className="p-3 rounded-md border bg-background/70 flex flex-col justify-between gap-1 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold">Template</h2>
                    <span className="text-[10px] px-2 py-1 rounded-full border bg-purple-500/20 text-purple-700">Meta</span>
                  </div>
                  <div className="text-xs font-medium truncate" title={templateName}>{templateName || '—'}</div>
                  <div className="text-[9px] text-muted-foreground">Template ID: {templateId ?? 'N/A'}</div>
                  <div className="text-[9px] text-muted-foreground truncate" title={templateDescription}>
                    <span className="font-medium text-foreground/70">Description:</span> {templateDescription || 'No description'}
                  </div>
                  <div className="text-[9px] text-muted-foreground">Created: {templateCreatedOn ? formatDateTime(templateCreatedOn) : '—'}</div>
                  <div className="mt-1">
                    {templateId ? (
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="text-[10px] px-2 py-1 h-auto"
                      >
                        <Link href={`/template-details/${templateId}`} prefetch aria-label="View Template Details">View Template</Link>
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" disabled className="text-[10px] px-2 py-1 h-auto">View Template</Button>
                    )}
                  </div>
                </div>
              </div>
              {/* Sequential signing: show full inline previews; Parallel: hide entire section */}
              {isSequentialSigningEnabled && (
                <div>
                  <h2 className="text-sm font-semibold mb-2">Signed Documents ({documents.length})</h2>
                  {(() => {
                    // Ordered recipients (priority first, then id) to determine signing sequence
                    const ordered = [...recipients].sort((a,b)=> {
                      const ap = a.recipientRolePriority ?? 0; const bp = b.recipientRolePriority ?? 0;
                      if (ap !== bp) return ap - bp;
                      return a.workflowRecipientId - b.workflowRecipientId;
                    });
                    const signedSeq = ordered.filter(r => r.hasSigned);
                    const totalSeq = ordered.length;
                    const partial = signedSeq.length > 0 && signedSeq.length < totalSeq;
                    if (!partial) return null;
                    const nextPending = ordered[signedSeq.length];
                    return (
                      <div className="mb-4 p-2 rounded-md border text-[10px] bg-amber-50/80 border-amber-300 text-amber-800 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-200 flex flex-wrap gap-1">
                        <span className="font-semibold">Partially Signed:</span>
                        <span className="truncate">{signedSeq.map(r=> r.displayName).join(', ')}</span>
                        <span>({signedSeq.length}/{totalSeq})</span>
                        {nextPending && (
                          <span>– Awaiting <strong>{nextPending.displayName}</strong></span>
                        )}
                      </div>
                    );
                  })()}
                  <div className="space-y-6">
                    {documents.map(doc => {
                      const frId = resolveLatestFileResourceId(doc.versions as any, doc.latestVersionNumber, doc.signedDocumentId, documents);
                      // Fallback: derive from recipient signature versions if missing (sequential shared doc case)
                      let fallbackFrId: number | null = null;
                      if (!frId) {
                        const scanPickId = (v: any) => {
                          if (!v || typeof v !== 'object') return null;
                          if (typeof v.fileResourceId === 'number') return v.fileResourceId;
                          if (typeof v.FileResourceId === 'number') return v.FileResourceId;
                          for (const k of Object.keys(v)) {
                            if (k.toLowerCase() === 'fileresourceid' && typeof (v as any)[k] === 'number') return (v as any)[k];
                          }
                          return null;
                        };
                        const allSignatureVersions: any[] = [];
                        for (const r of recipients) {
                          const sigRaw = Array.isArray(r.signatures) ? r.signatures : (r.signatures && typeof r.signatures === 'object') ? unwrapValues<any>(r.signatures) : [];
                          for (const sig of sigRaw) {
                            const verRaw = Array.isArray(sig.versions) ? sig.versions : (sig.versions && typeof sig.versions === 'object') ? unwrapValues<any>(sig.versions) : [];
                            for (const v of verRaw) allSignatureVersions.push(v);
                          }
                        }
                        if (allSignatureVersions.length) {
                          // Prefer highest versionNumber with a fileResourceId
                          const withIds = allSignatureVersions.filter(v => scanPickId(v) != null);
                          withIds.sort((a,b)=> (b?.versionNumber ?? 0) - (a?.versionNumber ?? 0));
                          if (withIds[0]) fallbackFrId = scanPickId(withIds[0]);
                        }
                        if (!fallbackFrId && process.env.NODE_ENV !== 'production') {
                          console.debug('[Sequential][SignedDocs][Fallback] Unable to derive fileResourceId from signatures', { doc, recipients });
                        }
                      }
                      const effectiveFrId = frId || fallbackFrId;
                      return (
                        <div key={doc.signedDocumentId} className="rounded-md border bg-background/60 shadow-sm overflow-hidden">
                          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/40">
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold">Document #{doc.signedDocumentId}</span>
                              <span className="text-[10px] text-muted-foreground">Latest v{doc.latestVersionNumber}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {effectiveFrId && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={()=> viewFileResourceNewTab(effectiveFrId!, workflowId)}
                                    className="h-auto text-[10px] px-2 py-1 flex items-center gap-1"
                                  ><EyeIcon /> View in New Tab</Button>
                                  {/* Download removed from preview header (redundant with embedded viewer) */}
                                </>
                              )}
                              {!effectiveFrId && <span className="text-[10px] px-2 py-1 rounded border bg-amber-500/10 text-amber-700">File unavailable</span>}
                            </div>
                          </div>
                          {/* Inline preview via existing file-resource page iframe for consistency */}
                          {effectiveFrId ? (
                            <div className="w-full h-[480px] bg-background">
                              <iframe
                                src={`/file-resource/${effectiveFrId}?workflowId=${workflowId}`}
                                title={`Signed Document ${doc.signedDocumentId}`}
                                className="w-full h-full"
                              />
                            </div>
                          ) : (
                            <div className="p-4 text-[10px] text-muted-foreground">Cannot display preview (missing FileResource ID).</div>
                          )}
                        </div>
                      );
                    })}
                    {documents.length === 0 && <div className="text-[10px] text-muted-foreground">No signed documents yet.</div>}
                  </div>
                </div>
              )}
            </>
          )}
          {mounted && !detailsQuery.isLoading && !detailsQuery.error && !data && <div className="text-xs text-muted-foreground">No workflow data.</div>}
          {mounted && detailsQuery.error && detailsQuery.error.response?.status !== 401 && <div className="text-xs text-destructive">Failed to load workflow details.</div>}
        </div>
 
  <div className={`flex-1 p-6 space-y-6 overflow-auto`}>
          {mounted && !detailsQuery.isLoading && !detailsQuery.error && data && (
            <div className="p-4 rounded-lg border bg-background/70 space-y-3 shadow-sm flex flex-col">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Recipients</h2>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] px-2 py-1 rounded-full border bg-muted/50">{filteredRecipients.length}/{recipients.length}</span> 
                  {(!isSequentialSigningEnabled) && (() => {
                    const pendingCount = recipients.filter(rc => !rc.hasSigned && mapEnvelopeStatusRaw(rc.envelopeStatus) === 'InProgress').length; 
                    const canBulkRemind = workflowStatus === 'In Progress' && pendingCount > 0;
                    if (!canBulkRemind) return null;
                    return (
                      <button
                        onClick={async () => {
                          if (bulkRemindLoading) return;
                          setBulkRemindLoading(true);
                          try {
                            const token = tokenRef.current;
                            if (!token) throw new Error('Missing auth token');
                            const resp = await fetch(`${API_BASE}/workflow/remind-all`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                              body: JSON.stringify({ workflowId: Number(workflowId) })
                            });
                            if (!resp.ok) throw new Error('Failed to send bulk reminders');
                            const json = await resp.json();
                            const total = json?.data?.TotalReminded ?? 0;
                            toast.success(total > 0 ? `Reminders sent (${total})` : 'No pending recipients to remind');
                          } catch (e:any) {
                            toast.error(e.message || 'Bulk reminder failed');
                          } finally {
                            setBulkRemindLoading(false);
                          }
                        }}
                        disabled={bulkRemindLoading}
                        className={`text-[9px] px-2 py-0.5 rounded border flex items-center gap-1 ${bulkRemindLoading ? 'opacity-60 cursor-not-allowed' : 'bg-amber-500/15 text-amber-700 border-amber-400/40 hover:bg-amber-500/25'} transition-colors`}
                        title="Send reminders to all pending recipients"
                      >
                        {bulkRemindLoading ? 'Reminding…' : (<><BroadcastIcon /> Remind All</>)}
                      </button>
                    );
                  })()}
                  {recipientConfig === 2 && (
                    <div className="flex gap-1">
                      <button onClick={()=> setShowTemplate(s=>!s)} className={`text-[9px] px-2 py-0.5 rounded border flex items-center gap-1 ${showTemplate? 'bg-purple-500/15 text-purple-700 border-purple-400/50':'bg-muted text-muted-foreground'}`} title="Toggle template recipients"><FileIcon /> Template</button>
                      <button onClick={()=> setShowCustom(s=>!s)} className={`text-[9px] px-2 py-0.5 rounded border flex items-center gap-1 ${showCustom? 'bg-cyan-500/15 text-cyan-700 border-cyan-400/50':'bg-muted text-muted-foreground'}`} title="Toggle custom recipients"><FileIcon /> Custom</button>
                    </div>
                  )}
                  <button onClick={openRecipientsModal} className="text-[9px] px-2 py-0.5 rounded border bg-muted hover:bg-muted/60 flex items-center gap-1" title="Maximize recipients view"><EyeIcon /> Max View</button>
                </div>
              </div>
              {/* Filter bar */}
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                    <input
                      type="text"
                      placeholder="Search recipients..."
                      value={recipientSearch}
                      onChange={e=> setRecipientSearch(e.target.value)}
                      className="flex-1 rounded-md border bg-background/60 px-2 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                  <select
                    value={statusFilter}
                    onChange={e=> setStatusFilter(e.target.value as typeof statusFilter)}
                    className="text-[11px] rounded-md border bg-background/60 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    title="Filter by status"
                  >
                    <option value="all">All</option>
                    <option value="signed">Signed</option>
                    <option value="pending">Pending</option>
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="failed">Failed</option>
                    <option value="expired">Expired</option>
                  </select>
                  {(recipientSearch || statusFilter !== 'all') && (
                    <button
                      onClick={()=> { setRecipientSearch(''); setStatusFilter('all'); }}
                      className="text-[10px] px-2 py-1 rounded-md border bg-muted/40 hover:bg-muted/60"
                    >Clear</button>
                  )}
                </div>
              </div>
              {/* Scrollable recipients list: height adapts to viewport; scrollbar hidden via no-scrollbar utility */}
              <div className={`space-y-3 mt-2 overflow-y-auto no-scrollbar pr-1`}
                   style={{ maxHeight: 'calc(100vh - 16rem)' }}
                   aria-label="Recipients list scroll container">
                {filteredRecipients.map(r => {
                  const signed = r.hasSigned;
                  const expanded = expandedRecipient === r.workflowRecipientId;
                  const originLabel = r.useDefaultUser ? 'Template' : 'Custom';
                  const originStyles = r.useDefaultUser ? 'bg-purple-500/10 text-purple-700 border-purple-400/40' : 'bg-cyan-500/10 text-cyan-700 border-cyan-400/40';
                  const invite = invitationState(r.envelopeStatus, signed);
                  const rawEnvelope = mapEnvelopeStatusRaw(r.envelopeStatus);
                  // Normalize signatures array (backend may send object or null)
                  const signatureRecords: WorkflowRecipientSignatureDetailsDto[] = Array.isArray(r.signatures)
                    ? (r.signatures as WorkflowRecipientSignatureDetailsDto[])
                    : (r.signatures && typeof r.signatures === 'object')
                      ? unwrapValues<WorkflowRecipientSignatureDetailsDto>(r.signatures as any)
                      : [];
                  // Reminder button visibility: show for recipients not signed whose envelope has been sent (InProgress) and not Failed/Expired.
                  // If sequential, only show for the currently active pending recipient (same logic as send mail) once already Sent.
                  let showReminderButton = false;
                  if (!signed && !['Failed','Expired'].includes(rawEnvelope)) {
                    if (rawEnvelope === 'InProgress') {
                      if (isSequentialSigningEnabled) {
                        // reuse ordered + firstPending, but firstPending must be this recipient
                        const ordered = [...filteredRecipients].sort((a,b)=> {
                          const ap = a.recipientRolePriority ?? 0; const bp = b.recipientRolePriority ?? 0;
                          if (ap !== bp) return ap - bp;
                          return a.workflowRecipientId - b.workflowRecipientId;
                        });
                        const firstPending = ordered.find(x => !x.hasSigned && ['Draft','InProgress','Completed'].includes(mapEnvelopeStatusRaw(x.envelopeStatus)));
                        if (firstPending && firstPending.workflowRecipientId === r.workflowRecipientId) {
                          showReminderButton = true;
                        }
                      } else {
                        showReminderButton = true;
                      }
                    }
                  }
                  // Suppress reminders unless workflow is actively in progress
                  if (workflowStatus !== 'In Progress') {
                    showReminderButton = false;
                  }
                  const reminderLoading = !!remindLoading[r.workflowRecipientId];
                  const triggerReminder = async () => {
                    if (reminderLoading) return;
                    setRemindLoading(prev => ({ ...prev, [r.workflowRecipientId]: true }));
                    try {
                      const token = tokenRef.current;
                      if (!token) throw new Error('Missing auth token');
                      // Single recipient reminder endpoint
                      const resp = await fetch(`${API_BASE}/workflow/remind-recipient`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ recipientId: r.workflowRecipientId })
                      });
                      if (!resp.ok) throw new Error('Failed to send reminder');
                      const json = await resp.json();
                      toast.success(json?.message || 'Reminder sent');
                    } catch (err: any) {
                      toast.error(err.message || 'Failed to send reminder');
                    } finally {
                      setRemindLoading(prev => ({ ...prev, [r.workflowRecipientId]: false }));
                    }
                  };
                  // Quick file actions: derive latest signed signature fileResourceId (if any)
                  const latestSignedSignature = signatureRecords
                    .filter(s => s.isSigned)
                    .sort((a,b) => (b.latestVersionNumber ?? 0) - (a.latestVersionNumber ?? 0))[0];
                  const quickFileResourceId = latestSignedSignature
                    ? resolveLatestFileResourceId(latestSignedSignature.versions as any, latestSignedSignature.latestVersionNumber, latestSignedSignature.signedDocumentId, documents)
                    : null;
                  const canQuickViewDownload = !!quickFileResourceId && quickFileResourceId > 0;
                  return (
                    <div key={r.workflowRecipientId} className={`group relative p-4 rounded-md border text-[11px] transition shadow-sm hover:shadow-md flex flex-col gap-3 ${signed? 'bg-green-50/70 border-green-300 dark:bg-green-900/20 dark:border-green-600':'bg-background/70 border-border/60'}`}> 
                      <div className="flex items-start justify-between gap-2">
                        <button onClick={()=> setExpandedRecipient(expanded? null : r.workflowRecipientId)} className="flex items-center gap-3 truncate text-left" title={r.displayName}>
                          <span className="h-10 w-10 rounded-full flex items-center justify-center text-[12px] font-semibold border shadow-sm" style={{ background: `hsl(${(r.displayName.charCodeAt(0)*37)%360}deg 65% 50%)`, color: 'white' }}>
                            {r.displayName.split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase()}
                          </span>
                          <span className="flex flex-col">
                            <span className="font-semibold leading-tight text-[12px] truncate max-w-[240px]">{r.displayName}</span>
                          </span>
                        </button>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${originStyles}`}>{originLabel}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${invite.tone}`}>{invite.label}</span>
                          {showReminderButton && (
                            <button
                              onClick={triggerReminder}
                              disabled={reminderLoading}
                              className={`text-[10px] px-2 py-0.5 rounded-md border font-medium flex items-center gap-1 ${reminderLoading? 'opacity-60 cursor-not-allowed':'hover:bg-amber-500/10'} bg-muted/40`}
                              title="Send reminder email"
                            >
                              {reminderLoading ? 'Reminding…' : (<><BellIcon /> Remind Now</>)}
                            </button>
                          )}
                          {canQuickViewDownload && (
                            <>
                              <button
                                onClick={() => viewFileResourceNewTab(quickFileResourceId!, workflowId)}
                                className="text-[10px] px-2 py-0.5 rounded-md border font-medium flex items-center gap-1 bg-muted/40 hover:bg-muted/60"
                                title="View signed file"
                              >
                                <EyeIcon /> View
                              </button>
                              <button
                                onClick={() => downloadFileResource(quickFileResourceId!)}
                                className="text-[10px] px-2 py-0.5 rounded-md border font-medium flex items-center gap-1 bg-muted/40 hover:bg-muted/60"
                                title="Download signed file"
                              >
                                <DownloadIcon /> Download
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-[10px] bg-muted/40 rounded-md px-3 py-2 border flex items-start gap-2">
                        <span className={`inline-block mt-0.5 h-2 w-2 rounded-full ${signed ? 'bg-green-500' : invite.label === 'Failed' ? 'bg-red-500' : invite.label === 'Expired' ? 'bg-amber-500' : invite.label === 'Sent' ? 'bg-blue-500 animate-pulse' : 'bg-neutral-400'}`} />
                        <span className="leading-snug">{envelopeStatusDescription(r.envelopeStatus, signed)}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-6 gap-y-1 text-[10px]">
                        <div className="flex gap-1"><span className="font-medium">Role:</span><span>{r.recipientRoleName || r.recipientRoleId || '-'}</span></div>
                        <div className="flex gap-1"><span className="font-medium">Recipient Action:</span><span>{mapDeliveryType(r.deliveryType)}</span></div>
                        <div className="flex gap-1"><span className="font-medium">Envelope:</span><span>{mapEnvelopeStatusDisplay(mapEnvelopeStatusRaw(r.envelopeStatus))}</span></div>
                        <div className="flex gap-1"><span className="font-medium">Status:</span><span>{deriveRecipientStatus(mapEnvelopeStatusRaw(r.envelopeStatus), signed)}</span></div>
                        {/* Removed Completed, Turnaround, useDefaultUser per UI simplification request */}
                        {/** Priority removed per request */}
                      </div>
                      {expanded && (
                        <div className="pt-2 border-t mt-2 space-y-2">
                          {signatureRecords.length === 0 && <div className="text-[10px] text-muted-foreground">No signature records</div>}
                          {signatureRecords.map((sig: WorkflowRecipientSignatureDetailsDto) => (
                            <div key={sig.recipientSignatureId} className="text-[10px] space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">Signature #{sig.recipientSignatureId}</span>
                                {!sig.isSigned && (
                                  <span className={`px-2 py-0.5 rounded-full border text-[9px] bg-amber-500/10 text-amber-700 border-amber-400/40`}>Pending</span>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 opacity-70">
                                <span>Doc ID: {sig.signedDocumentId}</span>
                                <span>Latest Ver: {sig.latestVersionNumber}</span>
                                <span>Signed At: {sig.signedAt ? new Date(sig.signedAt).toLocaleString() : '—'}</span>
                              </div>
                              {/* Removed version badges per request */}
                              {sig.isSigned && (
                                <div className="flex flex-wrap gap-2 pt-2">
                                  <button
                                    onClick={()=> {
                                      const frId = resolveLatestFileResourceId(sig.versions as SignedDocumentVersionDto[], sig.latestVersionNumber, sig.signedDocumentId, documents);
                                      if (!frId) { toast.error('Signed file unavailable'); return; }
                                      viewFileResourceNewTab(frId, workflowId);
                                    }}
                                    className="text-[10px] px-2 py-1 rounded border bg-muted hover:bg-muted/60 flex items-center gap-1"
                                  ><EyeIcon /> View</button>
                                  <button
                                    onClick={()=> {
                                      const frId = resolveLatestFileResourceId(sig.versions as SignedDocumentVersionDto[], sig.latestVersionNumber, sig.signedDocumentId, documents);
                                      if (!frId) { toast.error('Signed file unavailable'); if (process.env.NODE_ENV !== 'production') console.debug('[SignedDoc][Download] resolve failed', { sig }); return; }
                                      if (process.env.NODE_ENV !== 'production') console.debug('[SignedDoc][Download] resolved fileResourceId', frId, { sig });
                                      downloadFileResource(frId);
                                    }}
                                    className="text-[10px] px-2 py-1 rounded border bg-muted hover:bg-muted/60 flex items-center gap-1"
                                  ><DownloadIcon /> Download</button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Floating quick actions */}
                      {/* Hover action buttons removed per request */}
                    </div>
                  );
                })}
                {filteredRecipients.length === 0 && <div className="text-[11px] text-muted-foreground">No recipients (filter)</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </WorkflowDetailsDashboard>
    {pdfPreviewOpen && pdfPreviewUrl && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="relative w-[90vw] h-[85vh] bg-background border rounded-lg shadow-xl flex flex-col">
          <div className="flex items-center justify-between p-2 border-b">
            <span className="text-xs font-medium truncate">Signed Document Preview</span>
            <div className="flex items-center gap-2">
              <button
                onClick={()=> { if (pdfPreviewUrl) openInNewTab(pdfPreviewUrl); }}
                className="text-[10px] px-2 py-1 rounded border bg-muted hover:bg-muted/60 flex items-center gap-1"
                title="Open in new tab"
              ><EyeIcon /> New Tab</button>
              <button
                onClick={closePdfPreview}
                className="text-[10px] px-2 py-1 rounded border bg-muted hover:bg-muted/60 flex items-center gap-1"
                title="Close preview"
              ><CloseIcon /> Close</button>
            </div>
          </div>
          <div className="flex-1 w-full overflow-hidden">
            {previewContentType === 'pdf' && (
              <iframe src={pdfPreviewUrl} className="w-full h-full" title="Signed PDF" />
            )}
            {previewContentType === 'image' && (
              <div className="w-full h-full flex items-center justify-center bg-muted/30 p-2">
                <img src={pdfPreviewUrl} alt="Signed Document" className="max-h-full max-w-full object-contain" />
              </div>
            )}
            {!previewContentType && (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-xs text-muted-foreground p-4">
                <p>Preview not supported. Open in a new tab or download.</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={()=> openInNewTab(pdfPreviewUrl)} className="text-[10px] h-auto px-2 py-1">New Tab</Button>
                  <Button size="sm" variant="outline" onClick={()=> downloadFile(pdfPreviewUrl)} className="text-[10px] h-auto px-2 py-1">Download</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    {modalVisible && (
      <div
  className={`fixed inset-0 z-50 flex flex-col bg-background origin-bottom-right transform transition-[opacity,transform] duration-[400ms] ${modalActive? 'opacity-100 scale-100 translate-y-0 ease-out':'opacity-0 scale-[0.85] translate-y-4 ease-in'}`}
        aria-modal="true" role="dialog"
      >
        {/* Sticky header */}
        <div className="flex items-center justify-between h-14 px-4 border-b bg-background/95 backdrop-blur sticky top-0 z-10 transition-colors">
          <h3 className="text-sm font-semibold">All Recipients ({filteredRecipients.length})</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={closeRecipientsModal}
              className="text-[11px] px-3 py-1.5 rounded-md border bg-muted hover:bg-muted/70 transition-colors flex items-center gap-2"
              aria-label="Close recipients view"
            ><CloseIcon /> Close</button>
          </div>
        </div>
        {/* Scrollable content */}
  <div className={`flex-1 overflow-auto p-4`}> 
          {/* Modal filter bar */}
          <div className="mb-4 space-y-2">
            <div className="flex flex-wrap gap-2 items-center">
              <input
                type="text"
                placeholder="Search recipients..."
                value={recipientSearch}
                onChange={e=> setRecipientSearch(e.target.value)}
                className="flex-1 min-w-[200px] rounded-md border bg-background/60 px-2 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
              <select
                value={statusFilter}
                onChange={e=> setStatusFilter(e.target.value as typeof statusFilter)}
                className="text-[11px] rounded-md border bg-background/60 px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                title="Filter by status"
              >
                <option value="all">All</option>
                <option value="signed">Signed</option>
                <option value="pending">Pending</option>
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="failed">Failed</option>
                <option value="expired">Expired</option>
              </select>
              {recipientConfig === 2 && (
                <div className="flex gap-1">
                  <button onClick={()=> setShowTemplate(s=>!s)} className={`text-[9px] px-2 py-0.5 rounded border flex items-center gap-1 ${showTemplate? 'bg-purple-500/15 text-purple-700 border-purple-400/50':'bg-muted text-muted-foreground'}`} title="Toggle template recipients"><FileIcon /> Template</button>
                  <button onClick={()=> setShowCustom(s=>!s)} className={`text-[9px] px-2 py-0.5 rounded border flex items-center gap-1 ${showCustom? 'bg-cyan-500/15 text-cyan-700 border-cyan-400/50':'bg-muted text-muted-foreground'}`} title="Toggle custom recipients"><FileIcon /> Custom</button>
                </div>
              )}
              {(recipientSearch || statusFilter !== 'all' || (recipientConfig === 2 && (!showTemplate || !showCustom))) && (
                <button
                  onClick={()=> { setRecipientSearch(''); setStatusFilter('all'); setShowTemplate(true); setShowCustom(true); }}
                  className="text-[10px] px-2 py-1 rounded-md border bg-muted/40 hover:bg-muted/60"
                >Clear</button>
              )}
              <span className="text-[10px] px-2 py-1 rounded-full border bg-muted/40">{filteredRecipients.length}/{recipients.length}</span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {filteredRecipients.map(r => {
                const signed = r.hasSigned;
                const originLabel = r.useDefaultUser ? 'Template' : 'Custom';
                const originStyles = r.useDefaultUser ? 'bg-purple-500/10 text-purple-700 border-purple-400/40' : 'bg-cyan-500/10 text-cyan-700 border-cyan-400/40';
                const invite = invitationState(r.envelopeStatus, signed);
                const rawEnvelope = mapEnvelopeStatusRaw(r.envelopeStatus);
                const signatureRecords: WorkflowRecipientSignatureDetailsDto[] = Array.isArray(r.signatures)
                  ? (r.signatures as WorkflowRecipientSignatureDetailsDto[])
                  : (r.signatures && typeof r.signatures === 'object')
                    ? unwrapValues<WorkflowRecipientSignatureDetailsDto>(r.signatures as any)
                    : [];
                let showReminderButton = false;
                if (!signed && !['Failed','Expired'].includes(rawEnvelope)) {
                  if (rawEnvelope === 'InProgress') showReminderButton = true; // simplified inside modal
                }
                // Suppress reminders unless workflow is actively in progress
                if (workflowStatus !== 'In Progress') {
                  showReminderButton = false;
                }
                const reminderLoading = !!remindLoading[r.workflowRecipientId];
                const triggerReminder = async () => {
                  if (reminderLoading) return;
                  setRemindLoading(prev => ({ ...prev, [r.workflowRecipientId]: true }));
                  try {
                    const token = tokenRef.current;
                    if (!token) throw new Error('Missing auth token');
                    const resp = await fetch(`${API_BASE}/workflow/remind-recipient`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                      body: JSON.stringify({ recipientId: r.workflowRecipientId })
                    });
                    if (!resp.ok) throw new Error('Failed to send reminder');
                    toast.success('Reminder sent');
                  } catch (err: any) {
                    toast.error(err.message || 'Failed to send reminder');
                  } finally {
                    setRemindLoading(prev => ({ ...prev, [r.workflowRecipientId]: false }));
                  }
                };
                return (
                  <div key={r.workflowRecipientId} className={`p-4 rounded-md border text-[11px] flex flex-col gap-3 hover:shadow-sm transition ${signed? 'bg-green-50/70 border-green-300 dark:bg-green-900/20 dark:border-green-600':'bg-background/70 border-border/60'}`}> 
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 truncate" title={r.displayName}>
                        <span className="h-10 w-10 rounded-full flex items-center justify-center text-[12px] font-semibold border shadow-sm" style={{ background: `hsl(${(r.displayName.charCodeAt(0)*37)%360}deg 65% 50%)`, color: 'white' }}>{r.displayName.split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase()}</span>
                        <span className="flex flex-col">
                          <span className="font-semibold leading-tight text-[12px] truncate max-w-[180px]">{r.displayName}</span>
                          <span className="text-[9px] text-muted-foreground">ID #{r.workflowRecipientId}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap justify-end">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${originStyles}`}>{originLabel}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${invite.tone}`}>{invite.label}</span>
                        {showReminderButton && (
                          <button onClick={triggerReminder} disabled={reminderLoading} className={`text-[10px] px-2 py-0.5 rounded-md border font-medium flex items-center gap-1 ${reminderLoading? 'opacity-60 cursor-not-allowed':'hover:bg-blue-500/10'} bg-muted/40`} title="Send reminder">
                            {reminderLoading ? 'Reminding…' : (<><BellIcon /> Remind</>)}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-[10px] bg-muted/40 rounded-md px-3 py-2 border flex items-start gap-2">
                      <span className={`inline-block mt-0.5 h-2 w-2 rounded-full ${signed ? 'bg-green-500' : invite.label === 'Failed' ? 'bg-red-500' : invite.label === 'Expired' ? 'bg-amber-500' : invite.label === 'Sent' ? 'bg-blue-500 animate-pulse' : 'bg-neutral-400'}`} />
                      <span className="leading-snug">{envelopeStatusDescription(r.envelopeStatus, signed)}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-[10px]">
                      <div className="flex gap-1"><span className="font-medium">Role:</span><span>{r.recipientRoleName || r.recipientRoleId || '-'}</span></div>
                      <div className="flex gap-1"><span className="font-medium">Recipient Action:</span><span>{mapDeliveryType(r.deliveryType)}</span></div>
                      <div className="flex gap-1"><span className="font-medium">Envelope:</span><span>{mapEnvelopeStatusDisplay(mapEnvelopeStatusRaw(r.envelopeStatus))}</span></div>
                      <div className="flex gap-1"><span className="font-medium">Status:</span><span>{deriveRecipientStatus(mapEnvelopeStatusRaw(r.envelopeStatus), signed)}</span></div>
                      {/* Removed Completed, Turnaround, useDefaultUser per UI simplification request */}
                      {/** Priority removed per request */}
                    </div>
                    <div className="pt-2 border-t mt-2 space-y-2">
                      {signatureRecords.length === 0 && <div className="text-[10px] text-muted-foreground">No signature records</div>}
                      {signatureRecords.map(sig => (
                        <div key={sig.recipientSignatureId} className="text-[10px] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">Signature #{sig.recipientSignatureId}</span>
                            {!sig.isSigned && (
                              <span className={`px-2 py-0.5 rounded-full border text-[9px] bg-amber-500/10 text-amber-700 border-amber-400/40`}>Pending</span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 opacity-70">
                            <span>Doc ID: {sig.signedDocumentId}</span>
                            <span>Latest Ver: {sig.latestVersionNumber}</span>
                            <span>Signed At: {sig.signedAt ? new Date(sig.signedAt).toLocaleString() : '—'}</span>
                          </div>
                          {/* Removed version badges per request */}
                          {sig.isSigned && (
                            <div className="flex flex-wrap gap-2 pt-2">
                              <button
                                onClick={()=> {
                                  const frId = resolveLatestFileResourceId(sig.versions as SignedDocumentVersionDto[], sig.latestVersionNumber, sig.signedDocumentId, documents);
                                  if (!frId) { toast.error('Signed file unavailable'); return; }
                                  viewFileResourceNewTab(frId, workflowId);
                                }}
                                className="text-[10px] px-2 py-1 rounded border bg-muted hover:bg-muted/60 flex items-center gap-1"
                              ><EyeIcon /> View</button>
                              <button
                                onClick={()=> {
                                  const frId = resolveLatestFileResourceId(sig.versions as SignedDocumentVersionDto[], sig.latestVersionNumber, sig.signedDocumentId, documents);
                                  if (!frId) { toast.error('Signed file unavailable'); if (process.env.NODE_ENV !== 'production') console.debug('[SignedDoc][Modal][Download] resolve failed', { sig }); return; }
                                  if (process.env.NODE_ENV !== 'production') console.debug('[SignedDoc][Modal][Download] resolved fileResourceId', frId, { sig });
                                  downloadFileResource(frId);
                                }}
                                className="text-[10px] px-2 py-1 rounded border bg-muted hover:bg-muted/60 flex items-center gap-1"
                              ><DownloadIcon /> Download</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default WorkflowDetailsPage;
