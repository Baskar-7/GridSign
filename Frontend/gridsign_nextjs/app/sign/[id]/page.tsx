"use client";
import React, { useState, useMemo, useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import SignatureModal from '@/components/signing/SignatureModal';
import { toast } from 'sonner';
import { BrandLogo } from '@/components/BrandLogo';
import { useSignFormDetails, mapSigningDetailsToContext, SigningField } from '@/hooks/useSignFormDetails';
import { useTemplateDetails } from '@/hooks/useTemplateDetails';
import { useFileResource } from '@/hooks/useFileResource';
import { postFormData, resolveApiUrl } from '@/lib/apiClient';
import { useQueryClient } from '@tanstack/react-query';
import { useDispatch } from 'react-redux';
import { setActiveComponent } from '@/lib/store/slices/mainContentSlice';

// Dynamic pdf-lib import
let pdfLibPromise: Promise<typeof import('pdf-lib')> | null = null;
const getPdfLib = () => { if (!pdfLibPromise) pdfLibPromise = import('pdf-lib'); return pdfLibPromise; };

// Using shared apiClient resolveApiUrl for consistent base URL handling.

// Types & mapping now imported from hook; PDF placeholder handled there until backend supplies resource.

// Dynamic import react-pdf (duplicated minimal logic from PDFViewer to avoid coupling)
// Local lightweight react-pdf dynamic import (mirrors prepare-document PDFViewer pattern)
interface ReactPdfLib { Document: any; Page: any; pdfjs: any }
const useReactPdfBasic = () => {
  const [lib, setLib] = React.useState<ReactPdfLib | null>(null);
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = await import('react-pdf');
        if (!mounted) return;
        let workerSrc: string | null = null;
        try {
          workerSrc = require('pdfjs-dist/build/pdf.worker.min?url');
          if (workerSrc && typeof workerSrc === 'string') {
            (mod.pdfjs as any).GlobalWorkerOptions.workerSrc = workerSrc;
          }
        } catch { /* ignore asset resolution errors */ }
        setLib({ Document: mod.Document, Page: mod.Page, pdfjs: mod.pdfjs });
      } catch (e) {
        console.error('[SigningPage] react-pdf dynamic import failed:', e);
      }
    })();
    return () => { mounted = false; };
  }, []);
  return lib;
};

// Overlay component (clean reimplementation)
const FieldOverlay: React.FC<{ field: SigningField; onFill: (v:string)=>void; value?:string; onSignature?: (field:SigningField)=>void; highlight?: boolean; debug?: boolean; }> = ({ field, onFill, value, onSignature, highlight, debug }) => {
  const baseWidth = field.width || (field.fieldType === 'initials' ? 80 : field.fieldType === 'signature' ? 160 : 140);
  const baseHeight = field.height || (field.fieldType === 'signature' ? 80 : field.fieldType === 'checkbox' ? 24 : field.fieldType === 'date' ? 40 : 40);
  const labelRef = useRef<HTMLDivElement | null>(null);
  // Start at 0 so first mount measures exact height; previous default (20) caused jump after remount.
  const [labelOffsetPx, setLabelOffsetPx] = useState<number>(0);
  useLayoutEffect(() => {
    // Only measure when label is actually rendered (value empty)
    if (value) return; // label hidden when value present
    const el = labelRef.current; if (!el) return;
    const measure = () => {
      const h = el.getBoundingClientRect().height; // includes padding
      // Use h + 0 for even tighter positioning (requested additional 2px reduction)
      setLabelOffsetPx(Math.ceil(h) + 0);
    };
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => { ro.disconnect(); };
  }, [field.fieldName, field.isRequired, value]);
  return (
    <div
      className={"absolute group transition " + (highlight ? 'ring-2 ring-amber-500 animate-pulse bg-amber-50 dark:bg-amber-900/30' : '') + (debug ? ' outline outline-1 outline-red-500/70' : '')}
      data-field-id={field.fieldId}
      data-page-number={field.page}
      style={{ width: baseWidth, minHeight: baseHeight }}
    >
      {!value && (
        <div
          ref={labelRef}
          className="absolute left-0 px-2 py-1 rounded-md text-[10px] font-medium border bg-background/95 backdrop-blur flex items-center gap-1 max-w-full select-none"
          style={{ top: -labelOffsetPx || -18, pointerEvents:'none', zIndex: 5 }}
        >
          <span className="truncate" title={field.fieldName}>{field.fieldName}</span>
          {field.isRequired && <span className="text-red-500">*</span>}
        </div>
      )}
      {/* Interactive area anchored exactly at given coordinates */}
      {field.fieldType === 'date' && (
        <input
          type="date"
          value={value || ''}
          onChange={e => onFill(e.target.value)}
          className="h-8 text-xs rounded-md border border-border px-2 bg-background/80 w-full"
          style={{ height: Math.min(40, baseHeight), lineHeight: `${Math.min(40, baseHeight)}px` }}
        />
      )}
      {(field.fieldType === 'text' || field.fieldType === 'name' || field.fieldType === 'fullname') && (
        <input
          type="text"
          value={value || ''}
          onChange={e => onFill(e.target.value)}
          placeholder={field.fieldName}
          className="h-8 text-xs rounded-md border border-border px-2 bg-background/70 w-full focus:outline-none focus:ring-0"
          style={{ height: Math.min(40, baseHeight), lineHeight: `${Math.min(40, baseHeight)}px` }}
        />
      )}
      {field.fieldType === 'email' && (
        <input
          type="email"
          value={value || ''}
          onChange={e => onFill(e.target.value)}
          placeholder="email@example.com"
          className="h-8 text-xs rounded-md border border-border px-2 bg-background/70 w-full focus:outline-none focus:ring-0"
          style={{ height: Math.min(40, baseHeight), lineHeight: `${Math.min(40, baseHeight)}px` }}
        />
      )}
      {field.fieldType === 'mobile' && (
        <input
          type="tel"
          value={value || ''}
          onChange={e => onFill(e.target.value.replace(/[^0-9+\-() ]/g,''))}
          placeholder="Mobile"
          className="h-8 text-xs rounded-md border border-border px-2 bg-background/70 w-full tracking-wide focus:outline-none focus:ring-0"
          style={{ height: Math.min(40, baseHeight), lineHeight: `${Math.min(40, baseHeight)}px` }}
        />
      )}
      {field.fieldType === 'checkbox' && (
        <label className="flex items-center gap-2 text-[11px] select-none">
          <input
            type="checkbox"
            checked={value === 'true'}
            onChange={e => onFill(e.target.checked ? 'true' : 'false')}
            className="h-4 w-4"
          />
          <span className="truncate" title={field.fieldName}>{field.fieldName}</span>
        </label>
      )}
      {field.fieldType === 'signature' && (
        <div className="space-y-1">
          {value ? (
            <div className="relative border rounded-md overflow-hidden bg-white" style={{ height: baseHeight }}>
              <img src={value} alt="Signature" className="w-full h-full object-contain" />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="absolute top-1 right-1 h-6 px-2 text-[10px]"
                onClick={() => onSignature && onSignature(field)}
              >Edit</Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSignature && onSignature(field)}
              className="text-[11px] w-full"
              style={{ height: Math.min(40, baseHeight) }}
            >Click to Sign</Button>
          )}
        </div>
      )}
          {field.fieldType === 'image' && (
            <div className="space-y-1">
              {value ? (
                <div className="relative border rounded-md overflow-hidden bg-white" style={{ height: baseHeight }}>
                  <img src={value} alt="Image Field" className="w-full h-full object-contain" />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="absolute top-1 right-1 h-6 px-2 text-[10px]"
                    onClick={() => onFill('')}
                  >Change</Button>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => onFill(String(reader.result));
                      reader.readAsDataURL(file);
                    }}
                    className="text-[10px]"
                  />
                  <div className="text-[9px] opacity-60">Upload image</div>
                </div>
              )}
            </div>
          )}
          {field.fieldType === 'file' && (
            <div className="space-y-1">
              {value ? (
                <div className="relative border rounded-md bg-muted/40 px-2 py-1 flex items-center justify-between text-[10px]" style={{ minHeight: Math.min(40, baseHeight) }}>
                  <span className="truncate" title="File attached">File attached</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-6 px-2 text-[10px]"
                    onClick={() => onFill('')}
                  >Remove</Button>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <input
                    type="file"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => onFill(`${file.name}::${reader.result}`);
                      reader.readAsDataURL(file);
                    }}
                    className="text-[10px]"
                  />
                  <div className="text-[9px] opacity-60">Attach file</div>
                </div>
              )}
            </div>
          )}
      {field.fieldType === 'initials' && (
        <input
          type="text"
          value={value || ''}
          onChange={e => onFill(e.target.value.toUpperCase().slice(0, 4))}
          placeholder="Init"
          className="h-8 text-xs rounded-md border border-border px-2 bg-background/80 w-full"
          style={{ height: Math.min(40, baseHeight), lineHeight: `${Math.min(40, baseHeight)}px` }}
        />
      )}
      {debug && (
        <div className="absolute bottom-0 right-0 text-[8px] bg-black/40 text-white px-1 py-0.5 rounded-tr">
          {baseWidth}×{Math.round(baseHeight || 0)}
        </div>
      )}
    </div>
  );
};

const SigningPage: React.FC = () => {
  const params = useParams();
  const [signingToken, setSigningToken] = useState<string | null>(null);
  const [recipientIdFromQuery, setRecipientIdFromQuery] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const dispatch = useDispatch();
  const router = useRouter();
  const requestId = params?.id as string;
  const envelopeId = Number(requestId);
  const detailsQuery = useSignFormDetails(!Number.isNaN(envelopeId) ? envelopeId : null);
  const rawDetails = detailsQuery.data?.data;
  const ctx = useMemo(() => mapSigningDetailsToContext(rawDetails), [rawDetails]);
  const templateId = rawDetails?.templateId ? Number(rawDetails.templateId) : null;
  const templateDetails = useTemplateDetails({ templateId, enabled: !!templateId });
  const firstTemplateFileId = useMemo(() => {
    const docs = templateDetails.data?.data?.documents || [];
    for (const d of docs) { if (d.files && d.files.length > 0) return d.files[0].fileId || null; }
    return null;
  }, [templateDetails.data]);
  const fileRes = useFileResource({ fileResourceId: firstTemplateFileId || 0, enabled: !!firstTemplateFileId });
  const pdfUrlToUse = fileRes.fileUrl || ctx?.pdfUrl || '';
  // Hydration guard to avoid SSR/client markup mismatch
  const [hydrated, setHydrated] = useState(false);
  useEffect(()=> { setHydrated(true); }, []);
  const [activeRecipientIndex, setActiveRecipientIndex] = useState(0);
  const [fieldValues, setFieldValues] = useState<Record<string,string>>({}); // key: fieldId
  const [submitting, setSubmitting] = useState(false);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [activeSignatureField, setActiveSignatureField] = useState<SigningField | null>(null);
  const [highlightFieldId, setHighlightFieldId] = useState<number | null>(null);
  // Removed manual signed PDF upload; we'll auto-generate on submit.
  const viewerRef = React.useRef<HTMLDivElement | null>(null);
  // After data loads, set active recipient index to current signer if present
  React.useEffect(() => {
    // Extract query params (token & recipientId)
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const tok = sp.get('token');
      const rid = sp.get('recipientId');
      if (tok) setSigningToken(tok);
      if (rid) {
        const num = Number(rid);
        if (!Number.isNaN(num)) setRecipientIdFromQuery(num);
      }
    }
  }, []);

  React.useEffect(() => {
    if (!ctx) return;
    // Prefer recipientId from query to force correct recipient selection
    if (recipientIdFromQuery) {
      const idxByQuery = ctx.recipients.findIndex(r => r.workflowRecipientId === recipientIdFromQuery);
      if (idxByQuery >= 0) { setActiveRecipientIndex(idxByQuery); return; }
    }
    const idx = ctx.recipients.findIndex(r => r.isCurrentSigner);
    if (idx >= 0) setActiveRecipientIndex(idx);
  }, [ctx, recipientIdFromQuery]);

  const activeRecipient = useMemo(() => ctx?.recipients[activeRecipientIndex] || null, [ctx, activeRecipientIndex]);
  // Merge common fields (if any) so signer sees them alongside personal fields.
  // Common fields considered globally required / shared, we show them for every signer.
  // Avoid duplicate IDs by filtering if a recipient already has a field with same id.
 // @ts-expect-error – reason: third-party lib has wrong type
  const commonFields: SigningField[] = (ctx?.commonFields || []) as SigningField[];
  const allFields = useMemo(() => {
    if (!activeRecipient) return [] as SigningField[];
    if (!commonFields.length) return activeRecipient.fields;
    const existingIds = new Set(activeRecipient.fields.map(f=>f.fieldId));
    const merged = [...activeRecipient.fields];
    for (const cf of commonFields) { if (!existingIds.has(cf.fieldId)) merged.push(cf); }
    return merged;
  }, [activeRecipient, commonFields]);
  const [scale, setScale] = useState(1);
  const reactPdf = useReactPdfBasic();
  const [numPages, setNumPages] = useState(0);
  const [pageSizes, setPageSizes] = useState<Record<number,{width:number;height:number}>>({});
  // Debug mode now only via ?debug query param
  const debugMode = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('debug');
  }, []);
  const registerPageSize = (page: any) => {
    setPageSizes(prev => prev[page.pageNumber] ? prev : { ...prev, [page.pageNumber]: { width: page.width, height: page.height } });
  };
  const pages = useMemo(() => {
    if (!ctx) return [] as number[];
    return Array.from({ length: numPages || ctx.numPages }).map((_,i)=> i+1);
  }, [ctx, numPages]);

  const setValueForField = useCallback((fieldId:number, value:string) => {
    setFieldValues(prev => ({ ...prev, [String(fieldId)]: value }));
  }, []);

  const openSignatureModal = (field: SigningField) => {
    setActiveSignatureField(field);
    setSignatureModalOpen(true);
  };
  const focusField = (field: SigningField) => {
    setHighlightFieldId(field.fieldId);
    // Locate overlay element
    const el = document.querySelector(`[data-field-id="${field.fieldId}"][data-page-number="${field.page}"]`);
    if (el && viewerRef.current) {
      // Scroll so field is roughly centered vertically
      const containerRect = viewerRef.current.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const currentScroll = viewerRef.current.scrollTop;
      const offsetWithinContainer = elRect.top - containerRect.top;
      const targetScroll = currentScroll + offsetWithinContainer - containerRect.height / 2 + elRect.height / 2;
      viewerRef.current.scrollTo({ top: Math.max(targetScroll, 0), behavior: 'smooth' });
    }
    // Remove highlight after a delay
    setTimeout(() => {
      setHighlightFieldId(prev => prev === field.fieldId ? null : prev);
    }, 2500);
  };
  const handleSignatureSave = (dataUrl: string) => {
    if (!activeSignatureField) return;
    setValueForField(activeSignatureField.fieldId, dataUrl);
    setSignatureModalOpen(false);
    setActiveSignatureField(null);
  };

  const allFieldsCompleted = useMemo(() => {
    if (!activeRecipient) return false;
    return activeRecipient.fields.every(f => {
      const v = fieldValues[String(f.fieldId)];
      // Treat 'false' (checkbox explicitly unchecked) as filled, but empty string as not filled
      return v !== undefined && v !== '';
    });
  }, [activeRecipient, fieldValues]);
  const canSubmit = useMemo(() => {
    if (!activeRecipient || !ctx) return false;
    if (!ctx.canSign) return false;
    return allFieldsCompleted;
  }, [activeRecipient, ctx, allFieldsCompleted]);

  const handleSubmit = async () => {
    if (!ctx || !activeRecipient) return;
    if (!canSubmit) { toast.error('Complete all required fields'); return; }
    setSubmitting(true);
    try {
      if (!signingToken) { toast.error('Missing signing token'); return; }
      // Auto-generate filled PDF (similar to download routine) and send as signedDocument
      const pdfSourceUrl = pdfUrlToUse || ctx.pdfUrl;
      if (!pdfSourceUrl) throw new Error('No PDF available');
      const existingPdfBytes = await fetch(pdfSourceUrl).then(r => r.arrayBuffer());
      const { PDFDocument, rgb } = await getPdfLib();
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pagesArr = pdfDoc.getPages();
      const signer = ctx.recipients[activeRecipientIndex];
      for (const f of signer.fields) {
        const val = fieldValues[String(f.fieldId)];
        if (!val) continue;
        const pageIndex = f.page - 1;
        const page = pagesArr[pageIndex];
        if (!page) continue;
        const pdfW = page.getWidth();
        const pdfH = page.getHeight();
        const overlaySize = pageSizes[f.page] || { width: pdfW, height: pdfH };
        const scaleX = pdfW / overlaySize.width;
        const scaleY = pdfH / overlaySize.height;
        const [logicalX, logicalY] = f.position.split(',').map(v=>parseFloat(v));
        const x = logicalX * scaleX;
        if (f.fieldType === 'text' || f.fieldType === 'initials' || f.fieldType === 'date') {
          const fontSize = 10;
          const inputHeightLogical = 32;
          const baselineYLogical = logicalY + (inputHeightLogical - fontSize) / 2 + fontSize;
          const drawY = pdfH - (baselineYLogical * scaleY);
          page.drawText(val, { x: x + 4, y: drawY, size: fontSize, color: rgb(0,0,0) });
        } else if (f.fieldType === 'checkbox') {
          const boxSizeLogical = 16;
          const drawY = pdfH - ((logicalY + boxSizeLogical) * scaleY);
          page.drawRectangle({ x, y: drawY, width: boxSizeLogical * scaleX, height: boxSizeLogical * scaleY, borderColor: rgb(0,0,0), borderWidth: 1 });
          if (val === 'true') page.drawText('✓', { x: x + 4, y: drawY + 4, size: 10, color: rgb(0,0,0) });
        } else if (f.fieldType === 'signature' || f.fieldType === 'image') {
          try {
            const base64Part = val.split(',')[1];
            if (base64Part) {
              const imgBytes = Uint8Array.from(atob(base64Part), c=>c.charCodeAt(0));
              const png = await pdfDoc.embedPng(imgBytes);
              const logicalWidth = (f.width || (f.fieldType === 'signature' ? 160 : 120)) * scaleX;
              const targetHeight = (f.height || (f.fieldType === 'signature' ? 80 : 60)) * scaleY;
              const aspectHeight = (png.height / png.width) * logicalWidth;
              const finalHeight = Math.min(targetHeight, aspectHeight);
              const drawY = pdfH - ((logicalY + finalHeight) * scaleY);
              page.drawImage(png, { x, y: drawY, width: logicalWidth, height: finalHeight });
            }
          } catch (e) { console.warn('Failed embedding image/signature', e); }
        }
      }
      const pdfBytes = await pdfDoc.save();
      const arrayBuffer: ArrayBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const autoFile = new File([blob], `${ctx.documentName.replace(/\s+/g,'_')}_signed.pdf`, { type: 'application/pdf' });
      const fd = new FormData();
      fd.append('signedDocument', autoFile, autoFile.name);
  fd.append('RecipientId', String(activeRecipient.workflowRecipientId));
  fd.append('Token', signingToken);
      const url = resolveApiUrl('workflow/completeSigning');
      if (process.env.NODE_ENV !== 'production') {
        // eslint-disable-next-line no-console
        console.debug('[CompleteSigning] POST', url, 'RecipientId=', activeRecipient.workflowRecipientId);
        for (const entry of fd.entries()) {
          const [key, val] = entry as [string, any];
          if (val instanceof File) {
            // eslint-disable-next-line no-console
            console.debug('[CompleteSigning] form field', key, { name: val.name, size: val.size, type: val.type });
          } else {
            // eslint-disable-next-line no-console
            console.debug('[CompleteSigning] form field', key, val);
          }
        }
      }
      let json: any;
      try {
        json = await postFormData<any>('workflow/completeSigning', fd);
      } catch (apiErr: any) {
        // apiErr matches ApiErrorShape from apiClient
        const msg = apiErr?.message || 'Failed completing signing';
        toast.error(msg);
        throw new Error(msg);
      }
      const status = json?.status || json?.Status;
      const message = json?.message || json?.Message;
      if (status === 'success' || status === 'info') {
        toast.success(status === 'success' ? (message || 'Document signed') : (message || 'Already signed'));
        // Invalidate all signForms queries (prefix match) so fresh data is loaded on return
        try { queryClient.invalidateQueries({ queryKey: ['signForms'] }); } catch {}
        // Ensure dashboard shows SignForms component after redirect
        try {
          localStorage.setItem('activeComponent', 'SignForms');
          dispatch(setActiveComponent('SignForms'));
          // Fire a storage event so listeners (Leftsidebar) can react immediately
          window.dispatchEvent(new StorageEvent('storage',{ key:'activeComponent', newValue: 'SignForms' }));
        } catch {}
        router.push('/');
        return; // done
      }
      throw new Error(message || 'Signing failed');
    } catch (e:any) {
      console.error(e);
      toast.error(e.message || 'Failed completing signing');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      if (!ctx) return;
      if (!pdfUrlToUse && !ctx.pdfUrl) { toast.error('No PDF available'); return; }
      const existingPdfBytes = await fetch(pdfUrlToUse || ctx.pdfUrl).then(r => r.arrayBuffer());
      const { PDFDocument, rgb } = await getPdfLib();
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pagesArr = pdfDoc.getPages();
      const signer = ctx.recipients[activeRecipientIndex];
      const debug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');
      for (const f of signer.fields) {
        const val = fieldValues[String(f.fieldId)];
        if (!val) continue;
        const pageIndex = f.page - 1;
        const page = pagesArr[pageIndex];
        if (!page) continue;
        const pdfW = page.getWidth();
        const pdfH = page.getHeight();
        const overlaySize = pageSizes[f.page] || { width: pdfW, height: pdfH };
        const scaleX = pdfW / overlaySize.width;
        const scaleY = pdfH / overlaySize.height;
  const [logicalX, logicalY] = f.position.split(',').map(v=>parseFloat(v));
  const x = logicalX * scaleX;
  // logicalY now represents the TOP of interactive area (label floats above), so no label offset
  const el = typeof document !== 'undefined' ? (document.querySelector(`[data-field-id="${f.fieldId}"][data-page-number="${f.page}"]`) as HTMLElement | null) : null;
  const elHeight = el ? el.clientHeight : null;
  const elWidth = el ? el.clientWidth : null;
  const inputHeightLogical = 32; // approximate for text/date/initials
  const signatureHeightLogical = (f.height || 80); // interactive area height for signature
        if (f.fieldType === 'text' || f.fieldType === 'initials' || f.fieldType === 'date') {
          const fontSize = 10;
          const baselineYLogical = logicalY + (inputHeightLogical - fontSize) / 2 + fontSize;
          const drawY = pdfH - (baselineYLogical * scaleY);
          page.drawText(val, { x: x + 4, y: drawY, size: fontSize, color: rgb(0,0,0) });
          if (debug) {
            const blockHeight = elHeight ?? inputHeightLogical;
            page.drawRectangle({ x, y: pdfH - ((logicalY + blockHeight) * scaleY), width: (elWidth ? elWidth * scaleX : 140 * scaleX), height: blockHeight * scaleY, borderColor: rgb(1,0,0), borderWidth: 0.4 });
          }
        } else if (f.fieldType === 'checkbox') {
          const boxSizeLogical = 16; // approximate visual size
          const drawY = pdfH - ((logicalY + boxSizeLogical) * scaleY);
          page.drawRectangle({ x, y: drawY, width: boxSizeLogical * scaleX, height: boxSizeLogical * scaleY, borderColor: rgb(0,0,0), borderWidth: 1 });
          if (val === 'true') {
            page.drawText('✓', { x: x + 4, y: drawY + 4, size: 10, color: rgb(0,0,0) });
          }
          if (debug) {
            page.drawRectangle({ x, y: drawY, width: boxSizeLogical * scaleX, height: boxSizeLogical * scaleY, borderColor: rgb(0,0,1), borderWidth: 0.4 });
          }
        } else if (f.fieldType === 'signature') {
          try {
            const base64 = val.split(',')[1];
            if (base64) {
              const imgBytes = Uint8Array.from(atob(base64), c=>c.charCodeAt(0));
              const png = await pdfDoc.embedPng(imgBytes);
              const logicalWidth = (f.width || 160) * scaleX;
              const targetHeight = (signatureHeightLogical) * scaleY;
              const aspectHeight = (png.height / png.width) * logicalWidth;
              const finalHeight = Math.min(targetHeight, aspectHeight);
              const drawY = pdfH - ((logicalY + finalHeight) * scaleY);
              const drawX = x;
              page.drawImage(png, { x: drawX, y: drawY, width: logicalWidth, height: finalHeight });
              if (debug) {
                page.drawRectangle({ x: drawX, y: drawY, width: logicalWidth, height: finalHeight, borderColor: rgb(0,1,0), borderWidth: 0.5 });
              }
            }
          } catch (e) { console.warn('Failed embedding signature image', e); }
        }
      }
      const pdfBytes = await pdfDoc.save();
      const arrayBuffer: ArrayBuffer = pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer;
      const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${ctx.documentName.replace(/\s+/g,'_')}_filled.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('PDF downloaded with filled fields');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate PDF');
    }
  };

  // Ensure consistent SSR -> client initial markup
  if (!hydrated) return <div className="h-screen flex items-center justify-center text-sm text-muted-foreground">Loading signing details…</div>;
  if (detailsQuery.isLoading) return <div className="h-screen flex items-center justify-center text-sm text-muted-foreground">Loading signing details…</div>;
  if (detailsQuery.error) {
    const statusCode = detailsQuery.error.response?.status;
    if (statusCode === 401) {
      toast.error('Session expired');
      setTimeout(()=> router.push('/signin'), 500);
    }
    return <div className="h-screen flex flex-col items-center justify-center gap-4 text-sm text-destructive"><p>{detailsQuery.error.message || 'Failed to load signing details'}</p><Button variant="outline" onClick={()=>router.back()}>Back</Button></div>;
  }
  if (!ctx) return <div className="h-screen flex items-center justify-center text-sm text-muted-foreground">No signing context available.</div>;

  return (
    <>
    <div className="w-full h-screen flex flex-col">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 h-14 flex items-center justify-between px-5 border-b border-border bg-background/95 backdrop-blur z-50">
        {/* Left: Back + Title & Zoom Controls */}
        <div className="flex items-center gap-6 min-w-0">
          <BackButton ariaLabel="Go back" onClick={() => router.back()} size="sm" />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Sign Document</span>
            <span className="text-[11px] text-muted-foreground truncate max-w-[220px]" title={ctx.documentName}>{ctx.documentName}</span>
          </div>
          <div className="hidden md:flex items-center gap-2 pl-4 border-l border-border/40">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Zoom</span>
            <Button size="sm" variant="outline" onClick={()=> setScale(s=> Math.max(0.5, +(s-0.1).toFixed(2)))} aria-label="Zoom out">-</Button>
            <span className="text-[11px] w-12 text-center">{Math.round(scale*100)}%</span>
            <Button size="sm" variant="outline" onClick={()=> setScale(s=> Math.min(2.5, +(s+0.1).toFixed(2)))} aria-label="Zoom in">+</Button>
            <Button size="sm" variant="ghost" onClick={()=> setScale(1)} aria-label="Reset zoom">Reset</Button>
            {/* Debug toggle removed; use ?debug query param */}
          </div>
        </div>
        {/* Center: Logo */}
        <BrandLogo className="h-14 w-auto" />
        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleDownloadPdf} aria-label="Download filled PDF" disabled={!activeRecipient || activeRecipient.fields.length===0 || (!pdfUrlToUse && !ctx.pdfUrl) || !allFieldsCompleted}>Download</Button>
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={!canSubmit || submitting} onClick={handleSubmit} aria-label="Finish and sign">
              {submitting? 'Submitting…': ctx.alreadySigned ? 'Already Signed' : ctx.isExpired ? 'Expired' : 'Finish & Sign'}
            </Button>
          </div>
        </div>
      </div>
      {/* Body */}
      <div className="flex-1 pt-14 flex overflow-hidden">
        {/* Left: recipient switcher */}
        <aside className="w-60 border-r border-border bg-muted/30 backdrop-blur-sm px-3 py-4 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Recipients</p>
            <span className="text-[10px] text-muted-foreground">{ctx.recipients.length}</span>
          </div>
          <div className="space-y-2 overflow-auto pr-1" style={{ maxHeight: '40vh' }}>
            {ctx.recipients.map((r, idx) => {
              const active = idx === activeRecipientIndex;
              const completed = r.fields.filter(f=>fieldValues[String(f.fieldId)]).length;
              const percent = r.fields.length === 0 ? 0 : Math.round((completed / r.fields.length) * 100);
              const initials = r.name.split(/\s+/).filter(Boolean).map(p=>p[0]).slice(0,2).join('').toUpperCase();
              return (
                <button
                  key={r.workflowRecipientId}
                  onClick={() => setActiveRecipientIndex(idx)}
                  className={`group w-full text-left rounded-md border text-[11px] flex flex-col gap-1 transition relative overflow-hidden ${active? 'bg-primary/95 text-primary-foreground border-primary shadow-sm':'bg-background hover:bg-muted border-border'}`}
                >
                  <div className="flex items-center gap-2 px-3 pt-2">
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-semibold border ${active? 'bg-primary-foreground/15 border-primary-foreground/40':'bg-muted border-border text-foreground/70'}`}>{initials || '?'}</div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate" title={r.name}>{r.name}</div>
                      <div className="text-[9px] opacity-70 truncate" title={r.email}>{r.email}</div>
                    </div>
                    <div className="text-[9px] font-mono px-1 py-0.5 rounded bg-muted/40 border border-border/40">{percent}%</div>
                  </div>
                  <div className="px-3 pb-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${active? 'bg-primary-foreground':'bg-primary/50'}`} style={{ width: `${percent}%` }} />
                    </div>
                    <span className="text-[9px] tabular-nums opacity-70">{completed}/{r.fields.length}</span>
                  </div>
                  {/* Removed 'Current' badge per request */}
                </button>
              );
            })}
          </div>
          {activeRecipient && (
            <div className="mt-4 p-3 rounded-md border bg-background/70 space-y-2 text-[10px]">
              <div className="flex items-center justify-between">
                <span className="font-semibold">Active Recipient</span>
                <span className="px-1 py-0.5 rounded bg-muted border border-border text-[9px]">{activeRecipient.role.role}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col"><span className="text-[9px] uppercase tracking-wide opacity-60">Fields</span><span className="font-medium">{activeRecipient.fields.length}</span></div>
                <div className="flex flex-col"><span className="text-[9px] uppercase tracking-wide opacity-60">Required</span><span className="font-medium">{activeRecipient.fields.filter(f=>f.isRequired).length}</span></div>
                <div className="flex flex-col"><span className="text-[9px] uppercase tracking-wide opacity-60">Completed</span><span className="font-medium">{activeRecipient.fields.filter(f=>fieldValues[String(f.fieldId)]).length}</span></div>
                <div className="flex flex-col"><span className="text-[9px] uppercase tracking-wide opacity-60">Pending</span><span className="font-medium">{activeRecipient.fields.filter(f=>!fieldValues[String(f.fieldId)]).length}</span></div>
              </div>
              {!ctx.canSign && <p className="text-[9px] text-muted-foreground">{ctx.isExpired ? 'Envelope expired.' : ctx.alreadySigned ? 'Already signed.' : 'Waiting for signing availability.'}</p>}
            </div>
          )}
        </aside>
        {/* Center: document viewer with pages */}
  <div ref={viewerRef} className="flex-1 relative bg-neutral-900/5 flex flex-col overflow-auto">
          <div className="flex flex-col items-center gap-12 py-8">
            {!reactPdf && <div className="text-xs text-muted-foreground">Loading PDF…</div>}
            {reactPdf && (
              <reactPdf.Document
                file={pdfUrlToUse || ctx.pdfUrl}
                onLoadSuccess={(pdf:any)=> setNumPages(pdf.numPages)}
                loading={<div className="text-xs text-muted-foreground">Rendering PDF…</div>}
                error={<div className="text-xs text-destructive">Failed to load PDF</div>}
              >
                {pages.map(pageNumber => {
                  const base = pageSizes[pageNumber];
                  const w = (base?.width || 800);
                  const h = (base?.height || 1100);
                  return (
                    <div key={pageNumber} data-page-wrapper data-page-number={pageNumber} className="relative border border-border bg-white shadow-md" style={{ width: w*scale, height: h*scale }}>
                      <div className="absolute left-2 top-2 text-[11px] px-2 py-1 rounded bg-muted/60 border border-border">Page {pageNumber}</div>
                      <div className="absolute top-0 left-0" style={{ transform:`scale(${scale})`, transformOrigin:'top left', width:w, height:h }}>
                        <reactPdf.Page
                          pageNumber={pageNumber}
                          scale={1}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                          loading={<div className="p-10 text-muted-foreground">Rendering…</div>}
                          onLoadSuccess={(p:any)=> registerPageSize(p)}
                        />
                        {/* Field overlays positioned using logical coordinates */}
                        <div className="absolute inset-0" style={{ pointerEvents:'none' }}>
                          {allFields.filter(f=>f.page===pageNumber).map(f => {
                            const [x,y] = f.position.split(',').map(v=>parseFloat(v));
                            return (
                              <div key={f.fieldId} style={{ position:'absolute', left:x, top:y, pointerEvents:'auto' }}>
                                <FieldOverlay
                                  field={f}
                                  value={fieldValues[String(f.fieldId)]}
                                  onFill={(v)=> setValueForField(f.fieldId, v)}
                                  onSignature={openSignatureModal}
                                  highlight={highlightFieldId === f.fieldId}
                                  debug={debugMode}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </reactPdf.Document>
            )}
          </div>
        </div>
        {/* Right: field details */}
        <aside className="w-72 border-l border-border bg-muted/30 backdrop-blur-sm px-3 py-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Field Details</p>
            <span className="text-[10px] text-muted-foreground">{allFields.length}</span>
          </div>
          {allFields.length === 0 && <p className="text-[11px] text-muted-foreground">No fields for current signer.</p>}
          <div className="space-y-2 overflow-auto pr-1" style={{ maxHeight:'55vh' }}>
            {allFields.map(f => {
              const rawVal = fieldValues[String(f.fieldId)] || '';
              const required = f.isRequired;
              const completed = !!rawVal;
              let displayVal: React.ReactNode;
              if (!rawVal) {
                displayVal = <span className="opacity-50">(empty)</span>;
              } else if (f.fieldType === 'signature') {
                displayVal = <span className="text-green-600">Signature captured</span>;
              } else if (f.fieldType === 'image') {
                displayVal = <span className="text-green-600">Image selected</span>;
              } else if (f.fieldType === 'file') {
                displayVal = <span className="text-green-600">File attached</span>;
              } else if (rawVal.startsWith('data:') && rawVal.length > 32) {
                displayVal = <span className="text-green-600">Binary data</span>;
              } else {
                const truncated = rawVal.length > 60 ? rawVal.slice(0,57) + '…' : rawVal;
                displayVal = <span className="font-mono">{truncated}</span>;
              }
              return (
                <button
                  key={f.fieldId}
                  onClick={() => focusField(f)}
                  type="button"
                  className={`text-left w-full group p-2 rounded-md border text-[11px] transition ${completed? 'bg-green-50 border-green-300 dark:bg-green-950/30 dark:border-green-700':'bg-background/70 border-border hover:bg-muted/60'} ${highlightFieldId===f.fieldId ? 'ring-2 ring-amber-500' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate" title={f.fieldName}>{f.fieldName}</span>
                      {required && !completed && <span className="text-[9px] text-red-500 font-semibold">*</span>}
                      {completed && <span className="text-[9px] px-1 py-0.5 rounded bg-green-500/15 text-green-700 dark:text-green-300 border border-green-400/40">Done</span>}
                    </div>
                    <span className="text-[9px] px-1 py-0.5 rounded bg-muted border border-border capitalize">{f.fieldType} • P{f.page}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    {required && completed && <span className="text-green-600">Required ✓</span>}
                    {required && !completed && <span className="text-red-500">Required</span>}
                    {!required && <span className="opacity-60">Optional</span>}
                  </div>
                  <div className="mt-1 flex flex-col text-[10px]">
                    <span className="font-medium">Value</span>
                    <div className="truncate max-w-full text-[10px]">{displayVal}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
    <SignatureModal
      open={signatureModalOpen}
      onClose={() => { setSignatureModalOpen(false); setActiveSignatureField(null); }}
      onSave={handleSignatureSave}
      initialDataUrl={activeSignatureField ? fieldValues[String(activeSignatureField.fieldId)] : undefined}
    />
    </>
  );
};

export default SigningPage;