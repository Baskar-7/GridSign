"use client";
import React, { useState, useCallback, useMemo, useEffect } from "react";
// Defer react-pdf import to the client to prevent SSR DOMMatrix errors under Turbopack.
// CSS can be imported up front safely.
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Field } from "./DocumentFieldMapper";
import { DraggableField } from "./DraggableField";

// Worker handling: avoid mutating sealed pdfjs properties (like disableWorker) under Turbopack.
// We'll decide a flag and pass it through Document's options instead.
// We'll load react-pdf lazily on the client.
interface ReactPdfLib { Document: any; Page: any; pdfjs: any }

const useReactPdf = () => {
  const [lib, setLib] = useState<ReactPdfLib | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = await import('react-pdf');
        if (!mounted) return;
        // Worker setup
        let pdfDisableWorker = true;
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const workerAsset: string = require('pdfjs-dist/build/pdf.worker.min?url');
          if (workerAsset && typeof workerAsset === 'string') {
            (mod.pdfjs as any).GlobalWorkerOptions.workerSrc = workerAsset;
            try {
              const testWorker = new Worker(workerAsset);
              testWorker.terminate();
              pdfDisableWorker = false;
            } catch {
              pdfDisableWorker = true;
            }
          }
        } catch { /* ignore */ }
        try {
          if (Object.isExtensible(mod.pdfjs)) {
            (mod.pdfjs as any).disableWorker = pdfDisableWorker;
          }
        } catch { /* ignore */ }
        setLib({ Document: mod.Document, Page: mod.Page, pdfjs: mod.pdfjs });
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('[PDFViewer] Failed to load react-pdf dynamically:', e);
      }
    })();
    return () => { mounted = false; };
  }, []);
  return lib;
};


export const PDFViewer: React.FC<{
  pdfUrl: string;
  zoom: number;
  fields: Field[];
  onFieldDrop: (fieldType: string, page: number, x: number, y: number) => void;
  onFieldUpdate: (id: string, updates: Partial<Field>) => void;
  onFieldSelect: (id: string | null) => void;
  selectedFieldId: string | null;
  activeRecipientId: string;
  onFieldRemove: (id: string) => void;
  onCanvasClick?: (pageNumber: number, x: number, y: number) => void;
  recipientColors?: Record<string, string>;
  visibleRecipients?: Set<string> | null;
  onNumPages?: (count: number) => void;
  snapToGrid?: boolean;
  gridSize?: number;
}> = ({
  pdfUrl,
  zoom,
  fields,
  onFieldDrop,
  onFieldUpdate,
  onFieldSelect,
  selectedFieldId,
  activeRecipientId,
  onFieldRemove,
  onCanvasClick,
  recipientColors = {},
  visibleRecipients = null,
  onNumPages,
  snapToGrid = false,
  gridSize = 8,
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageSizes, setPageSizes] = useState<Record<number, { width: number; height: number }>>({});

  const onLoadSuccess = useCallback((pdf: any) => {
    setNumPages(pdf.numPages);
    if (onNumPages) onNumPages(pdf.numPages);
  }, [onNumPages]);

  const registerPageSize = (pageNumber: number, width: number, height: number) => {
    setPageSizes(prev => prev[pageNumber] ? prev : { ...prev, [pageNumber]: { width, height } });
  };

  const reactPdf = useReactPdf();

  const pages = useMemo(() => {
    if (!reactPdf) return [];
    return Array.from({ length: numPages }, (_, i) => {
      const pageNumber = i + 1;
      const baseWidth = pageSizes[pageNumber]?.width || 0;
      const baseHeight = pageSizes[pageNumber]?.height || 0;
      const scaledWidth = baseWidth * zoom;
      const scaledHeight = baseHeight * zoom;
      return (
        <div
          key={`pdf-page-${pageNumber}`}
          className="relative border border-border shadow-sm"
          style={baseWidth ? { width: scaledWidth, height: scaledHeight } : undefined}
          onClick={(e) => {
            if (!onCanvasClick) return;
            const inner = e.currentTarget.querySelector('.pdf-page-inner') as HTMLDivElement | null;
            const rect = inner ? inner.getBoundingClientRect() : (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            const rawX = e.clientX - rect.left;
            const rawY = e.clientY - rect.top;
            const logicalX = rawX / zoom;
            const logicalY = rawY / zoom;
            // Guard: if click intersects an existing field, treat as selection only (creation suppressed)
            const intersectsExisting = fields.some(f => f.page === pageNumber && logicalX >= f.x && logicalX <= f.x + f.width && logicalY >= f.y && logicalY <= f.y + f.height);
            if (intersectsExisting) return; // DraggableField handles its own selection
            onCanvasClick(pageNumber, logicalX, logicalY);
          }}
        >
          {/* Inner unscaled layer scaled via transform to allow fields remain in logical coordinate system */}
          <div
            className="absolute top-0 left-0 pdf-page-inner"
            style={{
              width: baseWidth || 'auto',
              height: baseHeight || 'auto',
              transform: `scale(${zoom})`,
              transformOrigin: 'top left'
            }}
          >
            <reactPdf.Page
              pageNumber={pageNumber}
              scale={1}
              onLoadSuccess={(page: any) => registerPageSize(pageNumber, page.width, page.height)}
              loading={<div className="p-10 text-muted-foreground">Rendering...</div>}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
            <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
              {fields.filter(f => f.page === pageNumber).map(f => (
                <DraggableField
                  key={f.id}
                  field={f}
                  selected={f.id === selectedFieldId}
                  onUpdate={(updates) => onFieldUpdate(f.id, updates)}
                  onSelect={() => onFieldSelect(f.id)}
                  onRemove={() => onFieldRemove(f.id)}
                  activeRecipientId={activeRecipientId}
                  recipientColor={recipientColors[f.recipientId]}
                  dimmed={visibleRecipients ? !visibleRecipients.has(f.recipientId) : false}
                  snapToGrid={snapToGrid}
                  gridSize={gridSize}
                />
              ))}
            </div>
          </div>
        </div>
      );
    });
  }, [numPages, zoom, pageSizes, fields, selectedFieldId, activeRecipientId, onFieldUpdate, onFieldSelect, onFieldRemove, onCanvasClick]);

  if (!reactPdf) {
    return <div className="py-6 text-xs text-muted-foreground">Loading viewer...</div>;
  }

  return (
    <div className="relative w-full">
      <div className="mx-auto py-6 flex flex-col gap-6 items-center">
        <reactPdf.Document
          file={pdfUrl}
          onLoadSuccess={onLoadSuccess}
          onLoadError={(err: unknown) => {
            // eslint-disable-next-line no-console
            console.error('PDF load error:', err);
          }}
          loading={<div className="text-xs text-muted-foreground">Loading PDF...</div>}
          error={<div className="text-xs text-destructive">Failed to load PDF</div>}
        >
          {pages}
        </reactPdf.Document>
      </div>
    </div>
  );
};