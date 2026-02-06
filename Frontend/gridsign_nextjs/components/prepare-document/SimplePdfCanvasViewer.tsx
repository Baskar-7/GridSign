"use client";
import React, { useEffect, useRef, useState } from 'react';

// Lightweight canvas-based PDF renderer using pdfjs-dist directly.
// Avoids worker initialization entirely (main-thread rendering) to bypass Turbopack worker import issues.

interface Props {
  source: { url?: string; data?: ArrayBuffer | string }; // same shape style as react-pdf 'file'
  zoom: number;
  onNumPages?: (n: number) => void;
}

export const SimplePdfCanvasViewer: React.FC<Props> = ({ source, zoom, onNumPages }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null); setLoading(true); setNumPages(0);
      try {
        // Dynamic import to avoid SSR issues
        const pdfjs = await import('pdfjs-dist');
        // Force main-thread mode
        (pdfjs as any).GlobalWorkerOptions.workerSrc = undefined; // ensure no worker attempt
        const getDocument = (pdfjs as any).getDocument;
        const params: any = { disableWorker: true };
        if (source.data) params.data = source.data; else if (source.url) params.url = source.url;
        const loadingTask = getDocument(params);
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        setNumPages(pdf.numPages);
        onNumPages?.(pdf.numPages);
        // Render each page sequentially
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          if (cancelled) return;
          const viewport = page.getViewport({ scale: zoom });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          canvas.width = viewport.width; canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport }).promise;
          canvas.style.boxShadow = '0 0 0 1px var(--border)';
          canvas.style.background = 'white';
          canvas.style.marginBottom = '12px';
          containerRef.current?.appendChild(canvas);
        }
      } catch (e: any) {
        if (!cancelled) { console.error('[SimplePdfCanvasViewer] render failed', e); setError(e?.message || 'Failed to render PDF'); }
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => {
      cancelled = true;
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [source, zoom, onNumPages]);

  return (
    <div className="w-full flex flex-col items-center py-2">
      {loading && <div className="text-xs text-muted-foreground py-4">Rendering PDF...</div>}
      {error && <div className="text-xs text-destructive py-4">PDF Fallback Error: {error}</div>}
      <div ref={containerRef} className="flex flex-col items-center" />
    </div>
  );
};

export default SimplePdfCanvasViewer;
