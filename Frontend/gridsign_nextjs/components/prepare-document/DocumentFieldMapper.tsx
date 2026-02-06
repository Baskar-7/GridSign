"use client";
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { toast } from "sonner";
import { PDFViewer } from "./PDFViewer";
import { RecipientList } from "./RecipientList";
import { FieldToolbar } from "./FieldToolbar";
import { DrawerPanel } from "./DrawerPanel";
import { ContextBar } from "./ContextBar";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, RefreshCcw, FilePlus, PlayCircle } from "lucide-react";
import { Separator } from "@radix-ui/react-separator";

export interface Field {
  id: string;
  fieldId: number;
  fieldType: string;
  fieldName: string;
  isRequired: boolean;
  recipientId: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  // Common field markers (when a field is placed for ALL recipients)
  isCommon?: boolean;
  commonGroupId?: string; // groups replicated fields for de-duplication when building CommonFields payload
}

interface RecipientMeta { id: string; name: string; email: string; color: string; role?: string; deliveryType?: number }

interface Props {
  pdfUrl: string;
  recipients: RecipientMeta[];
  hasHeaderBar?: boolean;
  onFieldsUpdate?: (fields: { fieldId: number; fieldType: string; fieldName: string; position: string; isRequired: boolean; recipientId?: string; isCommon?: boolean; commonGroupId?: string }[]) => void;
  onSend?: () => Promise<boolean> | boolean;
  // Optional label override for the primary submission button (e.g. "Create Template" vs default "Send Document")
  sendLabel?: string;
  readOnly?: boolean; // when true, disable all editing and hide interactive toolbars
  compact?: boolean; // when true, render in minimized / embedded mode (shorter height)
  // Zoom control (external)
  zoom?: number; // if provided, component becomes controlled for zoom
  onZoomChange?: (zoom: number) => void; // notify parent when zoom changes internally
  hideInternalZoomControls?: boolean; // suppress built-in overlay zoom buttons
  presetFields?: { id: number | null; key: string; type: string; required: boolean; x?: number | null; y?: number | null; page?: number | null; width?: number | null; height?: number | null; recipientId?: string | null }[];
  debug?: boolean;
  showRecipientFilterDock?: boolean; // show bottom dock even in readOnly mode
  forceHideRecipientDock?: boolean; // always hide dock regardless of mode
  hideReadOnlyRecipientPanel?: boolean; // suppress side recipient list when readOnly
  allowRecipientFilteringInReadOnly?: boolean; // enable clicking recipient filters when readOnly
  alwaysInjectPresetFields?: boolean; // force injecting preset fields even when not readOnly (e.g., Mixed mode starting point)
}

const DocumentFieldMapper: React.FC<Props> = ({ pdfUrl, recipients, hasHeaderBar = false, onFieldsUpdate, onSend, sendLabel = 'Send Document', readOnly = false, compact = false, zoom: controlledZoom, onZoomChange, hideInternalZoomControls = false, presetFields = [], debug = false, showRecipientFilterDock = false, forceHideRecipientDock = false, hideReadOnlyRecipientPanel = false, allowRecipientFilteringInReadOnly = false, alwaysInjectPresetFields = false }) => {
  // Do not auto-inject 'ALL'; parent decides whether to include the pseudo-recipient.
  // Provide minimal fallback (still include ALL so common placement can be explored in isolation).
  const effectiveRecipients: RecipientMeta[] = recipients.length ? recipients.map(r => {
    // Force gray color for shared/common pseudo recipient ids
    if (r.id === 'ALL' || r.id === '__COMMON__') {
      return { ...r, color: '#6b7280' }; // Tailwind gray-500 hex
    }
    return r;
  }) : [
    { id: 'ALL', name: 'Shared', email: '', color: '#6b7280', role: 'Shared' },
    { id: 'r1', name: 'Recipient One', email: 'one@example.com', color: '#3b82f6' },
    { id: 'r2', name: 'Recipient Two', email: 'two@example.com', color: '#f59e42' }
  ];
  // Ensure we default to a specific (non-shared) recipient so initial placements aren't accidentally flagged common.
  const initialActiveRecipientId = React.useMemo(() => {
    const firstSpecific = effectiveRecipients.find(r => r.id !== 'ALL' && r.id !== '__COMMON__');
    return firstSpecific ? firstSpecific.id : (effectiveRecipients[0]?.id || 'recipient');
  }, [effectiveRecipients]);
  const [activeRecipientId, setActiveRecipientId] = useState(initialActiveRecipientId);
  const [fields, setFields] = useState<Field[]>([]);
  const [fieldCounter, setFieldCounter] = useState(1);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [past, setPast] = useState<Field[][]>([]);
  const [future, setFuture] = useState<Field[][]>([]);
  const isApplyingHistory = useRef(false);
  const [internalZoom, setInternalZoom] = useState(1);
  const zoom = controlledZoom !== undefined ? controlledZoom : internalZoom;
  const [pendingFieldType, setPendingFieldType] = useState<string | null>(null);
  // Default requirement flag for new field placements (controlled via FieldToolbar)
  // New fields default to required; user can toggle after selection in tools panel.
  const fieldTypes = ["signature", "date", "text", "checkbox", "initials", "name", "fullname", "email", "mobile"];
  const [leftOpen, setLeftOpen] = useState(true);
  // Open tools panel by default so user sees field placement options immediately.
  const [rightOpen, setRightOpen] = useState(true);
  const [filterRecipients, setFilterRecipients] = useState<Set<string>>(() => new Set(effectiveRecipients.map(r => r.id)));
  const [numPages, setNumPages] = useState(0);
  const GRID_SIZE = 8;
  const [showHud, setShowHud] = useState(false);
  // Use portable timeout type (works in browser + Node typings) to avoid mismatch warnings in Next.js
  const hudTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const key = `gridsign_fields_${pdfUrl}`;
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const parsed: Field[] = JSON.parse(raw);
        if (Array.isArray(parsed)) setFields(parsed);
      }
    } catch {}
  }, [pdfUrl]);

  useEffect(() => {
    // Inject preset fields in readOnly mode OR when explicitly forced (Mixed mode initial template fields)
    if (!readOnly && !alwaysInjectPresetFields) return;
    if (!presetFields.length) return;
    const recipientIdSet = new Set(recipients.map(r => r.id));
    console.log('[FieldMapper] Preset injection start', { presetCount: presetFields.length, readOnly, alwaysInjectPresetFields, recipientIds: Array.from(recipientIdSet).slice(0,5) });
    const mapped: Field[] = presetFields
      .filter(p => p.x !== null && p.y !== null)
      .map((p, idx) => {
        let recId = p.recipientId ? String(p.recipientId) : recipients.find(r => r.id !== 'ALL' && r.id !== '__COMMON__')?.id || recipients[0]?.id || 'recipient';
        if (!recipientIdSet.has(recId)) {
          const found = recipients.find(r => r.email && recId.includes(r.email));
          if (found) recId = found.id;
        }
        const isCommon = recId === 'ALL' || recId === '__COMMON__';
        return {
          id: String(p.id ?? idx + 1),
          fieldId: p.id ?? idx + 1,
          fieldType: p.type || 'text',
          fieldName: p.key || p.type || 'Field',
          isRequired: !!p.required,
          recipientId: recId,
          page: p.page ?? 1,
          x: p.x ?? 0,
          y: p.y ?? 0,
          width: p.width ?? (p.type === 'signature' ? 180 : 120),
          height: p.height ?? (p.type === 'signature' ? 50 : 40),
          ...(isCommon ? { isCommon: true, commonGroupId: `cmn-pre-${p.id ?? idx + 1}` } : {})
        };
      });
    setFields(mapped);
    // Propagate to parent so common fields become part of commonFields collection
    if (onFieldsUpdate) {
      onFieldsUpdate(mapped.map(f => ({
        fieldId: f.fieldId,
        fieldType: f.fieldType,
        fieldName: f.fieldName,
        position: `${Math.round(f.x)},${Math.round(f.y)},${f.page},${Math.round(f.width)},${Math.round(f.height)}`,
        isRequired: f.isRequired,
        recipientId: f.recipientId,
        isCommon: f.isCommon,
        commonGroupId: f.commonGroupId
      })));
    }
    const commonPreset = mapped.filter(m => m.isCommon);
    const specificPreset = mapped.filter(m => !m.isCommon);
    console.log('[FieldMapper] Preset injection complete', { injected: mapped.length, commonCount: commonPreset.length, specificCount: specificPreset.length, commonSample: commonPreset.slice(0,3), specificSample: specificPreset.slice(0,3) });
  }, [presetFields, readOnly, recipients, alwaysInjectPresetFields, onFieldsUpdate]);

  // Continuous classification diagnostics
  useEffect(() => {
    if (!fields.length) {
      console.log('[FieldMapper] No fields loaded yet');
      return;
    }
    const common = fields.filter(f => f.isCommon);
    const specific = fields.filter(f => !f.isCommon);
    console.log('[FieldMapper] Field classification snapshot', {
      total: fields.length,
      commonCount: common.length,
      specificCount: specific.length,
      activeRecipientId,
      activeRecipientIsShared: activeRecipientId === 'ALL' || activeRecipientId === '__COMMON__',
      commonSample: common.slice(0,5).map(f => ({ id: f.id, type: f.fieldType, page: f.page })),
      specificSample: specific.slice(0,5).map(f => ({ id: f.id, type: f.fieldType, page: f.page, recipient: f.recipientId }))
    });
  }, [fields, activeRecipientId]);

  useEffect(() => {
    console.log('[FieldMapper] Active recipient changed', { activeRecipientId, isSharedMode: activeRecipientId === 'ALL' || activeRecipientId === '__COMMON__' });
  }, [activeRecipientId]);

  // Normalize coordinates if template stored fractional or percent positions
  const [normalized, setNormalized] = useState(false);
  useEffect(() => {
    if (normalized) return;
    if (!fields.length) return;
    // Heuristics: if all x,y <= 1.5 treat as fractions (0-1).
    const allLEOnePointFive = fields.every(f => f.x <= 1.5 && f.y <= 1.5);
    // If not fractional, check percent style: all <= 100 and any > 1.5
    const allLEHundred = fields.every(f => f.x <= 100 && f.y <= 100);
    if (!allLEOnePointFive && !allLEHundred) {
      setNormalized(true); return; // assume already absolute
    }
    // Need page size to scale; if none yet, wait.
    // Find a representative page width/height from first page's rendered container by querying DOM (fallback if PDF not yet measured)
    const pageInner = document.querySelector('.pdf-page-inner');
    const rect = pageInner ? pageInner.getBoundingClientRect() : null;
    const pw = rect?.width || 0;
    const ph = rect?.height || 0;
    if (!pw || !ph) return; // wait until available
    setFields(prev => prev.map(f => {
      let nx = f.x; let ny = f.y;
      if (allLEOnePointFive) {
        nx = f.x * pw; ny = f.y * ph;
      } else if (allLEHundred) {
        nx = (f.x / 100) * pw; ny = (f.y / 100) * ph;
      }
      return { ...f, x: Math.round(nx), y: Math.round(ny) };
    }));
    setNormalized(true);
  }, [fields, normalized]);

  useEffect(() => {
    const key = `gridsign_fields_${pdfUrl}`;
    try { sessionStorage.setItem(key, JSON.stringify(fields)); } catch {}
  }, [fields, pdfUrl]);

  // Store previous state for undo; parameter removed (was unused)
  const pushHistory = () => {
    if (isApplyingHistory.current) return;
    setPast(prev => [...prev, fields]);
    setFuture([]);
  };

  const handleAddField = (fieldType: string, page: number, x: number, y: number) => {
    if (readOnly) return; // suppress adds in read-only mode
    const fieldName = fieldType === 'signature' ? 'Signature'
      : fieldType === 'text' ? 'Text'
      : fieldType === 'date' ? 'Date'
      : fieldType === 'checkbox' ? 'Checkbox'
      : fieldType === 'name' ? 'Name'
      : fieldType === 'fullname' ? 'Full Name'
      : fieldType === 'email' ? 'Email'
      : fieldType === 'mobile' ? 'Mobile'
      : fieldType;
    // Determine if placing for ALL/Shared recipients (common field).
    const isCommonActive = activeRecipientId === 'ALL' || activeRecipientId === '__COMMON__';
    if (isCommonActive) {
      // Single common field (no per-recipient replication). Backend will replicate via template/service logic.
      const groupId = `cmn-${Date.now()}-${fieldCounter}`;
      const commonField: Field = {
        id: String(fieldCounter),
        fieldId: fieldCounter,
        fieldType,
        fieldName,
        isRequired: true,
        // Preserve actual activeRecipientId (supports '__COMMON__' synthetic id)
        recipientId: activeRecipientId,
        page,
        x: Math.max(0, x),
        y: Math.max(0, y),
  width: fieldType === 'signature' ? 180 : (fieldType === 'email' ? 220 : fieldType === 'fullname' ? 240 : fieldType === 'mobile' ? 160 : 120),
  height: fieldType === 'signature' ? 50 : 40,
        isCommon: true,
        commonGroupId: groupId
      };
      setFieldCounter(c => c + 1);
      const next = [...fields, commonField];
      pushHistory();
      setFields(next);
      setSelectedFieldId(commonField.id);
      if (onFieldsUpdate) onFieldsUpdate(next.map(f => ({
        fieldId: f.fieldId,
        fieldType: f.fieldType,
        fieldName: f.fieldName,
        position: `${Math.round(f.x)},${Math.round(f.y)},${f.page},${Math.round(f.width)},${Math.round(f.height)}`,
        isRequired: f.isRequired,
        recipientId: f.recipientId,
        isCommon: f.isCommon,
        commonGroupId: f.commonGroupId
      })));
      return;
    }
    const newField: Field = {
      id: String(fieldCounter),
      fieldId: fieldCounter,
      fieldType,
      fieldName,
      isRequired: true,
      recipientId: activeRecipientId,
      page,
      x: Math.max(0, x),
      y: Math.max(0, y),
  width: fieldType === 'signature' ? 180 : (fieldType === 'email' ? 220 : fieldType === 'fullname' ? 240 : fieldType === 'mobile' ? 160 : 120),
  height: fieldType === 'signature' ? 50 : 40,
    };
    setFieldCounter(c => c + 1);
    const next = [...fields, newField];
    pushHistory();
    setFields(next);
    setSelectedFieldId(newField.id);
    if (onFieldsUpdate) onFieldsUpdate(next.map(f => ({
      fieldId: f.fieldId,
      fieldType: f.fieldType,
      fieldName: f.fieldName,
      position: `${Math.round(f.x)},${Math.round(f.y)},${f.page},${Math.round(f.width)},${Math.round(f.height)}`,
      isRequired: f.isRequired,
      recipientId: f.recipientId,
      isCommon: f.isCommon,
      commonGroupId: f.commonGroupId
    })));
  };

  const handleUpdateField = (id: string, updates: Partial<Field>) => {
    if (readOnly) return; // no updates in read-only mode
    const next = fields.map(f => f.id === id ? { ...f, ...updates } : f);
    setFields(next);
    if (onFieldsUpdate) onFieldsUpdate(next.map(f => ({
      fieldId: f.fieldId,
      fieldType: f.fieldType,
      fieldName: f.fieldName,
      position: `${Math.round(f.x)},${Math.round(f.y)},${f.page},${Math.round(f.width)},${Math.round(f.height)}`,
      isRequired: f.isRequired,
      recipientId: f.recipientId,
      isCommon: f.isCommon,
      commonGroupId: f.commonGroupId
    })));
  };

  const handleRemoveField = (id: string) => {
    if (readOnly) return; // no removals in read-only mode
    if (selectedFieldId === id) setSelectedFieldId(null);
    const next = fields.filter(f => f.id !== id);
    setFields(next);
    if (onFieldsUpdate) onFieldsUpdate(next.map(f => ({
      fieldId: f.fieldId,
      fieldType: f.fieldType,
      fieldName: f.fieldName,
      position: `${Math.round(f.x)},${Math.round(f.y)},${f.page},${Math.round(f.width)},${Math.round(f.height)}`,
      isRequired: f.isRequired,
      recipientId: f.recipientId,
      isCommon: f.isCommon,
      commonGroupId: f.commonGroupId
    })));
  };

  const nudgeSelected = useCallback((dx: number, dy: number) => {
    if (!selectedFieldId) return;
    setFields(prev => prev.map(f => f.id === selectedFieldId ? { ...f, x: Math.round((f.x + dx)/GRID_SIZE)*GRID_SIZE, y: Math.round((f.y + dy)/GRID_SIZE)*GRID_SIZE } : f));
    setShowHud(true);
    if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
    hudTimeoutRef.current = setTimeout(() => setShowHud(false), 1000);
  }, [selectedFieldId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (readOnly || !selectedFieldId) return;
      if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      const step = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowUp') nudgeSelected(0, -step);
      if (e.key === 'ArrowDown') nudgeSelected(0, step);
      if (e.key === 'ArrowLeft') nudgeSelected(-step, 0);
      if (e.key === 'ArrowRight') nudgeSelected(step, 0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nudgeSelected, selectedFieldId]);

  const toggleFilterRecipient = (id: string) => {
    if (readOnly && !allowRecipientFilteringInReadOnly) return; // block only if not permitted
    setFilterRecipients(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next.size === 0 ? new Set(effectiveRecipients.map(r => r.id)) : next;
      }
      return prev.size === effectiveRecipients.length ? new Set([id]) : next.add(id);
    });
  };
  const clearFilters = () => { if (readOnly && !allowRecipientFilteringInReadOnly) return; setFilterRecipients(new Set(effectiveRecipients.map(r => r.id))); };

  const recipientColorMap = useMemo(() => {
    const map: Record<string,string> = {}; effectiveRecipients.forEach(r => { map[r.id] = r.color; }); return map;
  }, [effectiveRecipients]);

  const contextTopClass = hasHeaderBar ? 'top-16' : 'top-4';
  const dockTopClass = hasHeaderBar ? 'top-32' : 'top-20';
  const pdfPaddingTop = hasHeaderBar ? 'pt-36' : 'pt-24';

  const showPdf = !!pdfUrl;
  return (
  <div className={compact ? "w-full h-[560px] bg-gradient-to-br from-background to-muted/10 relative overflow-hidden rounded-lg" : "w-full h-screen bg-gradient-to-br from-background to-muted/20 relative overflow-hidden"}>
      {!readOnly && (
        <div className={`fixed ${dockTopClass} left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 px-5 py-3 rounded-xl bg-background/70 backdrop-blur-sm shadow-md border border-border/60`}>
          <div className="flex items-center gap-2">
            <Button size="sm" variant={leftOpen ? 'default':'outline'} onClick={() => setLeftOpen(o=>!o)} className="flex items-center gap-1" aria-label="Toggle Recipients"><span className="text-xs">👥</span><span className="text-xs font-medium">Recipients</span></Button>
            <Button size="sm" variant={rightOpen ? 'default':'outline'} onClick={() => setRightOpen(o=>!o)} className="flex items-center gap-1" aria-label="Toggle Tools"><span className="text-xs">🛠️</span><span className="text-xs font-medium">Tools</span></Button>
          </div>
          <Separator orientation="vertical" className="h-6 bg-border" />
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="px-2 py-1 rounded bg-muted/40 border border-border/40">Fields: {fields.length}</span>
            <span className="px-2 py-1 rounded bg-muted/40 border border-border/40">Pages: {numPages || '—'}</span>
          </div>
          <Separator orientation="vertical" className="h-6 bg-border" />
          <Button
            size="sm"
            disabled={sending || !fields.length || !effectiveRecipients.length}
            onClick={async () => {
              setSending(true);
              const start = performance.now();
              try {
                await (onSend ? onSend() : Promise.resolve(false));
              } catch (e) {
                console.error(e); toast.error('Unexpected error during submission');
              } finally {
                console.info(`[FieldMapper] primary action completed in ${Math.round(performance.now()-start)}ms`);
                setSending(false);
              }
            }}
            className="relative overflow-hidden font-semibold bg-gradient-to-r from-primary to-primary/80 text-primary-foreground hover:from-primary/90 hover:to-primary/70 border border-primary/60 shadow"
          >
            <span className="flex items-center gap-2">
              {sending ? (/template/i.test(sendLabel) ? 'Creating…' : 'Starting…') : (
                <>
                  {/template/i.test(sendLabel) ? <FilePlus className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                  <span>{sendLabel}</span>
                </>
              )}
            </span>
          </Button>
        </div>
      )}
      {!readOnly && (
        <div className={`fixed ${contextTopClass} left-1/2 -translate-x-1/2 z-30`}>
          <ContextBar
            selectedField={fields.find(f => f.id === selectedFieldId) || null}
            pendingFieldType={pendingFieldType}
            setPendingFieldType={setPendingFieldType}
            zoom={zoom}
            zoomIn={() => {
              const next = Math.min(2.5, +(zoom + 0.1).toFixed(2));
              controlledZoom !== undefined ? onZoomChange?.(next) : setInternalZoom(next);
            }}
            zoomOut={() => {
              const next = Math.max(0.5, +(zoom - 0.1).toFixed(2));
              controlledZoom !== undefined ? onZoomChange?.(next) : setInternalZoom(next);
            }}
            resetZoom={() => {
              const next = 1;
              controlledZoom !== undefined ? onZoomChange?.(next) : setInternalZoom(next);
            }}
            canUndo={past.length>0}
            canRedo={future.length>0}
            undo={() => { if (!past.length) return; isApplyingHistory.current=true; setFuture(f=>[fields,...f]); const prev = past[past.length-1]; setPast(p=>p.slice(0,p.length-1)); setFields(prev); isApplyingHistory.current=false; }}
            redo={() => { if (!future.length) return; isApplyingHistory.current=true; const [next,...rest]=future; setFuture(rest); setPast(p=>[...p,fields]); setFields(next); isApplyingHistory.current=false; }}
            fieldTypes={fieldTypes}
            recipientOptions={effectiveRecipients}
            numPages={numPages}
            showEditingControls={selectedFieldId !== null}
            onDuplicateField={() => { if (!selectedFieldId) return; const src = fields.find(f=>f.id===selectedFieldId); if(!src) return; handleAddField(src.fieldType, src.page, src.x+12, src.y+12); }}
            onRemoveField={() => { if (selectedFieldId) handleRemoveField(selectedFieldId); }}
            onDonePlacement={() => { setSelectedFieldId(null); setPendingFieldType(null); }}
            onChangeFieldType={(type) => { if (!selectedFieldId) return; handleUpdateField(selectedFieldId, { fieldType: type }); }}
            onChangeRecipient={(rid) => { if (!selectedFieldId) return; handleUpdateField(selectedFieldId, { recipientId: rid }); }}
            onChangePage={(page) => { if (!selectedFieldId) return; handleUpdateField(selectedFieldId, { page }); }}
            onChangeSize={(w,h) => { if (!selectedFieldId) return; handleUpdateField(selectedFieldId, { width: Math.max(20,w), height: Math.max(20,h) }); }}
            onToggleRequired={() => { if (!selectedFieldId) return; const sf = fields.find(f=>f.id===selectedFieldId); if(!sf) return; handleUpdateField(selectedFieldId, { isRequired: !sf.isRequired }); }}
          />
        </div>
      )}
      {!readOnly && (
        <>
          <DrawerPanel side="left" open={leftOpen} onClose={() => setLeftOpen(false)} title="Recipients">
            <RecipientList recipients={effectiveRecipients} activeRecipientId={activeRecipientId} onSelect={setActiveRecipientId} onClose={() => setLeftOpen(false)} />
          </DrawerPanel>
          <DrawerPanel side="right" open={rightOpen} onClose={() => setRightOpen(false)} title="Field Tools">
            <FieldToolbar
              pendingFieldType={pendingFieldType}
              setPendingFieldType={setPendingFieldType}
              onClose={() => setRightOpen(false)}
              selectedField={selectedFieldId ? fields.find(f=>f.id===selectedFieldId) || null : null}
              fieldTypes={fieldTypes}
              recipientOptions={effectiveRecipients.map(r => ({ id: r.id, name: r.name }))}
              numPages={numPages}
              onChangeFieldType={(type) => { if (!selectedFieldId) return; handleUpdateField(selectedFieldId,{ fieldType: type }); }}
              onChangeRecipient={(rid) => { if (!selectedFieldId) return; handleUpdateField(selectedFieldId,{ recipientId: rid }); }}
              onChangePage={(page) => { if (!selectedFieldId) return; handleUpdateField(selectedFieldId,{ page }); }}
              onChangeSize={(w,h) => { if (!selectedFieldId) return; handleUpdateField(selectedFieldId,{ width: Math.max(20,w), height: Math.max(20,h) }); }}
              onToggleRequired={() => { if (!selectedFieldId) return; const sf = fields.find(f=>f.id===selectedFieldId); if(!sf) return; handleUpdateField(selectedFieldId,{ isRequired: !sf.isRequired }); }}
              onDuplicateField={() => { if (!selectedFieldId) return; const src = fields.find(f=>f.id===selectedFieldId); if(!src) return; handleAddField(src.fieldType, src.page, src.x+12, src.y+12); }}
              onRemoveField={() => { if (!selectedFieldId) return; handleRemoveField(selectedFieldId); }}
              onDonePlacement={() => { setSelectedFieldId(null); setPendingFieldType(null); }}
            />
          </DrawerPanel>
        </>
      )}
        {readOnly && !hideReadOnlyRecipientPanel && (
          <div className="fixed top-24 left-4 z-40 w-72 max-h-[60vh] overflow-y-auto no-scrollbar rounded-lg border border-border bg-background/90 backdrop-blur shadow-lg p-3 space-y-2">
            <div className="text-xs font-semibold tracking-wide mb-1 flex items-center justify-between">
              <span>Recipients</span>
              <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground">Read-only</span>
            </div>
            {effectiveRecipients.map(r => (
              <div key={r.id} className="flex flex-col gap-0.5 rounded px-2 py-1 text-[11px] border" style={{ borderColor: r.color }}>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ background: r.color }} />
                  <span className="font-medium truncate" title={r.name}>{r.name}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="truncate max-w-[60%]" title={r.email}>{r.email}</span>
                  {r.role && r.role.trim().length > 0 && (
                    <span className="ml-2 px-1 py-0.5 rounded bg-muted/60 text-[9px] font-medium" title={r.role}>{r.role}</span>
                  )}
                </div>
              </div>
            ))}
            {!effectiveRecipients.length && <div className="text-[10px] text-muted-foreground">No recipients</div>}
          </div>
        )}
  {/* Scroll container with enhanced vertical spacing; add extra top offset when editing so recipient/tool dock never obscures first PDF page */}
  <div className={`w-full h-full overflow-y-auto no-scrollbar ${(() => {
    if (hasHeaderBar) {
      if (compact) return 'pt-8';
      // When not readOnly, allocate more space for the floating dock (was pt-20). Increase to pt-32.
      return readOnly ? 'pt-24' : 'pt-32';
    } else {
      if (compact) return 'pt-4';
      return readOnly ? 'pt-12' : 'pt-16';
    }
  })()} px-3 ${compact ? 'pb-8' : 'pb-24'}`}>        
        {showPdf ? (
          <PDFViewer
            pdfUrl={pdfUrl}
            zoom={zoom}
            fields={fields}
            // Debug: wrap onFieldDrop
            onFieldDrop={readOnly ? () => {} : (type,page,x,y) => { console.log('[FieldMapper] Drop field', { type,page,x,y, recipient: activeRecipientId }); handleAddField(type,page,x,y); }}
            onFieldUpdate={(id, updates) => { if (!readOnly) handleUpdateField(String(id), updates); }}
            onFieldSelect={(id) => { if (readOnly) return; setSelectedFieldId(id); if (pendingFieldType) setPendingFieldType(null); }}
            selectedFieldId={readOnly ? null : selectedFieldId}
            activeRecipientId={activeRecipientId}
            onFieldRemove={(id) => { if (!readOnly) handleRemoveField(String(id)); }}
            onCanvasClick={(page,x,y) => { if (!readOnly && pendingFieldType) handleAddField(pendingFieldType, page, x, y); }}
            recipientColors={recipientColorMap}
            visibleRecipients={filterRecipients}
            onNumPages={setNumPages}
            snapToGrid={!readOnly}
            gridSize={GRID_SIZE}
          />
        ) : (
          <div className="w-full flex flex-col items-center justify-center py-24 text-center gap-3">
            <div className="text-sm font-medium">No PDF available</div>
            <div className="text-[11px] text-muted-foreground max-w-xs">The template does not have a primary file to preview yet.</div>
          </div>
        )}
      </div>
      {!hideInternalZoomControls && (
        <div className="absolute top-2 right-2 z-40 flex flex-col gap-1">
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 hover:bg-muted"
            onClick={() => {
              const next = Math.max(0.5, +(zoom - 0.1).toFixed(2));
              controlledZoom !== undefined ? onZoomChange?.(next) : setInternalZoom(next);
            }}
            aria-label="Zoom Out"
            title="Zoom Out (-)"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="h-8 w-8 inline-flex items-center justify-center flex-col rounded-md border bg-background/80 backdrop-blur text-[10px] font-medium select-none" title="Zoom Level">
            {Math.round(zoom * 100)}%
          </div>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 hover:bg-muted"
            onClick={() => {
              const next = Math.min(2.5, +(zoom + 0.1).toFixed(2));
              controlledZoom !== undefined ? onZoomChange?.(next) : setInternalZoom(next);
            }}
            aria-label="Zoom In"
            title="Zoom In (+)"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => {
              const next = 1;
              controlledZoom !== undefined ? onZoomChange?.(next) : setInternalZoom(next);
            }}
            aria-label="Reset Zoom"
            title="Reset Zoom"
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </div>
      )}
  {(!forceHideRecipientDock && (showRecipientFilterDock || (!readOnly))) && (
        <div
          className={`
            ${compact ? 'absolute' : 'fixed'}
            ${compact ? 'bottom-2 left-1/2 -translate-x-1/2' : 'bottom-5 left-1/2 -translate-x-1/2'}
            z-40 px-3 py-2 rounded-lg bg-card/90 backdrop-blur
            border border-border shadow-lg flex flex-wrap items-center gap-2
            max-w-[90%]
          `}
          style={{
            // Add slight padding to avoid zoom controls (top-right) overlap when narrow
            marginBottom: compact ? '0' : '0',
          }}
        >
        {effectiveRecipients.map(r => {
          const active = filterRecipients.has(r.id);
          return (
            <button key={r.id} onClick={() => toggleFilterRecipient(r.id)} disabled={readOnly && !allowRecipientFilteringInReadOnly} className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded transition ${active ? 'bg-background shadow-sm':'opacity-70 hover:opacity-100'} ${readOnly && !allowRecipientFilteringInReadOnly ? 'cursor-not-allowed opacity-50' : ''}`} style={{ border: `1px solid ${r.color}` }}>
              <span className="inline-block w-2 h-2 rounded-full" style={{ background:r.color }} />
              {r.name.split(' ')[0]}
            </button>
          );
        })}
        <Separator orientation="vertical" className="h-6 bg-border" />
        <button onClick={clearFilters} disabled={readOnly && !allowRecipientFilteringInReadOnly} className="text-[11px] px-2 py-1 rounded border border-border hover:bg-muted transition disabled:opacity-50" >Clear</button>
        </div>
      )}
  {!readOnly && showHud && selectedFieldId && (() => { const f = fields.find(fl => fl.id === selectedFieldId); if(!f) return null; return (
        <div className="fixed top-14 right-4 z-50 bg-card/90 backdrop-blur border border-border rounded px-3 py-2 shadow">
          <div className="text-[11px] font-mono">x:{Math.round(f.x)} y:{Math.round(f.y)} w:{Math.round(f.width)} h:{Math.round(f.height)}</div>
          <div className="text-[10px] text-muted-foreground">Shift+Arrows = 10px step</div>
        </div> ); })()}
    {readOnly && debug && fields.length > 0 && (
      <div className="fixed top-4 left-4 z-50 max-h-[50vh] overflow-y-auto no-scrollbar border bg-background/95 backdrop-blur rounded-lg shadow p-3 text-[10px] font-mono space-y-1">
        {fields.map(f => (
          <div key={f.id}>p{f.page} id:{f.id} ({Math.round(f.x)},{Math.round(f.y)}) {Math.round(f.width)}x{Math.round(f.height)}</div>
        ))}
      </div>
    )}
    </div>
  );
};

export default DocumentFieldMapper;

// NOTE: Label overlap improvement suggestion implemented separately on signing page. For mapping placement we can later add inline labels or collision avoidance if required.
