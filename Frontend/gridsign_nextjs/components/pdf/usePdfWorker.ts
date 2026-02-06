"use client";
import { useEffect, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

interface ReactPdfLib { Document: any; Page: any; pdfjs: any }

// Real worker setup for Next.js 15 + Turbopack.
// Uses '?url' import so Turbopack treats the worker entry as an asset URL string.
// Ensures pdf.js runs inside a true Web Worker, eliminating fake worker + importScripts errors.
export function usePdfWorker(): ReactPdfLib | null {
  const [lib, setLib] = useState<ReactPdfLib | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [mod, workerSrc] = await Promise.all([
          import('react-pdf'),
          import('pdfjs-dist/build/pdf.worker.mjs?url').then(m => m.default as string)
        ]);
        const pdfjs = (mod.pdfjs as any);
        if (workerSrc && typeof workerSrc === 'string') {
          pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
        }
        if (mounted) setLib({ Document: mod.Document, Page: mod.Page, pdfjs });
      } catch (e) {
        console.error('[usePdfWorker] Worker init failed, fallback without worker:', e);
        try {
          const mod = await import('react-pdf');
          const pdfjs = (mod.pdfjs as any);
          if (mounted) setLib({ Document: mod.Document, Page: mod.Page, pdfjs });
        } catch (inner) {
          console.error('[usePdfWorker] Fallback also failed:', inner);
        }
      }
    })();
    return () => { mounted = false; };
  }, []);
  return lib;
}
