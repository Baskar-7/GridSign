"use client";
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Minimal inline icons (reuse style from workflow page)
const BackIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" {...props}><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
);
const DownloadIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" {...props}><path d="M12 3v14"/><path d="m6 11 6 6 6-6"/><path d="M5 21h14"/></svg>
);
const RefreshIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" {...props}><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6l3 2"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6l-3-2"/></svg>
);

// Dedicated file resource viewer using the FileResource API. Supports PDF inline display; for other content types shows generic download panel.
const FileResourceViewerPage: React.FC = () => {
  const params = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const rawId = params?.id as string | undefined;
  const fileResourceId = rawId ? parseInt(rawId, 10) : NaN;
  const fromWorkflow = search.get('workflowId');
  const API_BASE = process.env.NEXT_PUBLIC_LOCAL_API_URL?.replace(/\/$/, '') || 'http://localhost:5035/api';

  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    try { tokenRef.current = typeof window !== 'undefined' ? localStorage.getItem('token') : null; } catch {}
  }, []);

  const apiUrl = `${API_BASE}/FileResource/${fileResourceId}`;

  const fetchFile = async () => {
    if (!fileResourceId || fileResourceId <= 0 || Number.isNaN(fileResourceId)) {
      setError('Invalid file resource id');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(apiUrl, { headers: tokenRef.current ? { Authorization: `Bearer ${tokenRef.current}` } : {} });
      if (!resp.ok) {
        throw new Error(`Failed (${resp.status}) to load file resource`);
      }
      const ct = resp.headers.get('Content-Type') || 'application/octet-stream';
      const disp = resp.headers.get('Content-Disposition');
      if (disp) {
        // Try to extract filename="..."
        const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disp);
        if (m) setFileName(decodeURIComponent(m[1] || m[2]));
      }
      setContentType(ct);
      const buf = await resp.arrayBuffer();
      const blob = new Blob([buf], { type: ct });
      setObjectUrl(prev => { if (prev) URL.revokeObjectURL(prev); return URL.createObjectURL(blob); });
    } catch (e: any) {
      const msg = e.message || 'Error loading file';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFile(); /* eslint-disable react-hooks/exhaustive-deps */ }, [fileResourceId]);

  useEffect(() => () => { setObjectUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; }); }, []);


  const downloadFile = () => {
    if (!objectUrl) return; 
    const a = document.createElement('a');
    a.href = objectUrl; a.download = fileName || `file-resource-${fileResourceId}`; document.body.appendChild(a); a.click(); a.remove();
  };

  const isPdf = contentType?.includes('pdf');

  return (
    <div className="flex flex-col h-dvh w-dvw bg-background text-foreground">
      <header className="h-14 border-b border-border/40 flex items-center justify-between px-4 gap-3 bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          {/* Back button removed per request */}
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold truncate" title={fileName || `File Resource ${fileResourceId}`}>{fileName || `File Resource ${fileResourceId}`}</span>
            <span className="text-[10px] text-muted-foreground truncate">Content-Type: {contentType || '—'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" disabled={loading} onClick={fetchFile} className="gap-1"><RefreshIcon /> {loading ? 'Loading…':'Refresh'}</Button>
          {/* Header download button removed per request; direct download still available inside non-PDF panel */}
        </div>
      </header>
      <main className="flex-1 overflow-auto flex flex-col">
        {error && (
          <div className="p-4 text-sm text-red-600">{error}</div>
        )}
        {!error && loading && (
          <div className="flex-1 flex items-center justify-center"><div className="text-xs animate-pulse">Loading file…</div></div>
        )}
        {!loading && !error && objectUrl && (
          isPdf ? (
            <iframe title="PDF Viewer" src={objectUrl} className="flex-1 w-full" />
          ) : (
            <div className="p-6 text-sm space-y-4">
              <div>This file type can&apos;t be previewed inline.</div>
              <div className="text-[11px] text-muted-foreground break-all">Direct API URL: <code className="px-1 py-0.5 bg-muted rounded">{apiUrl}</code></div>
              <Button size="sm" variant="default" onClick={downloadFile} className="gap-1"><DownloadIcon /> Download File</Button>
            </div>
          )
        )}
      </main>
    </div>
  );
};

export default FileResourceViewerPage;
