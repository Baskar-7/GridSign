"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import axios, { AxiosError } from "axios";
import { toast } from "sonner";
import DocumentFieldMapper from "@/components/prepare-document/DocumentFieldMapper";
import { BrandLogo } from "@/components/BrandLogo";
import { Home, FileText, Layers } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from 'lucide-react';
import BackButton from '@/components/ui/BackButton';
import { Field, Recipient, Role, WorkflowData } from "@/types/workflow";

// Extended mapper update field (superset of workflow Field) received from DocumentFieldMapper on updates.
// We intentionally keep coordinates optional because the mapper currently emits a consolidated position string; if raw
// numeric coordinates are provided we will use them directly, else fall back to parsing position.
type MapperUpdateField = {
  fieldId: number;
  fieldType: string;
  fieldName: string;
  position: string; // encoded "x,y,page,width,height" (page/size optional)
  isRequired: boolean;
  recipientId?: string;
  isCommon?: boolean;
  commonGroupId?: string;
  x?: number;
  y?: number;
  page?: number;
  width?: number;
  height?: number;
};

interface MappingContextRecipientField {
  fieldId: number;
  fieldType: string;
  fieldName: string;
  position: string; // "x,y"
  isRequired: boolean;
}
interface MappingContextRecipient {
  email: string;
  name: string;
  role: Role;
  deliveryType?: number;
  fields?: MappingContextRecipientField[];
  templateRecipientId?: number | null;
  useDefaultUser?: boolean; // mixed-mode identity flag
}
interface MappingContext {
  pdfName: string;
  pdfUrl: string;
  pdfDataUrl?: string; // base64 data URL for original file
  recipients: MappingContextRecipient[];
  formValues: any;
  fromWorkflowTab?: boolean; // indicates creation initiated from workflow tab (should not start immediately)
  templateId?: string | null;
  recipientConfiguration?: 'FromTemplate' | 'CustomRecipients' | 'Mixed' | 'CreateNewTemplate';
  isTemplateCreation?: boolean; // new flag indicating template creation flow instead of workflow
  isSequentialSigningEnabled?: boolean; // propagate sequential signing capability to gate common fields
  commonFields?: Array<{ fieldId: number | null; fieldType: string; fieldName: string; position?: string | null; isRequired: boolean }>; // backend supplied shared fields
}

// Frontend mirror of backend CreateWorkFlowDto for clarity & validation prior to FormData append
interface CreateWorkflowDto {
  RecipientConfiguration: number; // enum numeric value mapping
  TemplateId?: string | null;
  ValidTill: string; // ISO date (yyyy-MM-dd)
  AutoRemainder: boolean;
  ReminderIntervalDays: number;
  IsSequentialSigningEnabled: boolean;
  DocumentName?: string;
  Description?: string;
  RecipientMessage?: string;
  Recipients: Array<{
    email: string;
    name: string;
    deliveryType: number;
    role: Role;
    fields: Array<{ fieldId: number; fieldType: string; fieldName: string; position: string; isRequired: boolean }>;
    templateRecipientId?: number | null;
    useDefaultUser?: boolean;
  }>;
  CommonFields: Array<{ fieldId: number; fieldType: string; fieldName: string; position: string; isRequired: boolean }>;
  StartImmediately: boolean;
}

const PrepareDocumentPage = () => {
  const [ctx, setCtx] = useState<MappingContext | null>(null);
  // Initialize workflowData independently of ctx to avoid conditional hook order issues
  const [workflowData, setWorkflowData] = useState<WorkflowData | null>(null);
  const [startImmediately, setStartImmediately] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const router = useRouter();
  // Determine read-only status early (needed for recipientsForMapper dependency ordering)
  const isReadOnlyTemplate = !!ctx?.templateId && ctx?.recipientConfiguration !== 'CreateNewTemplate';

  useEffect(() => {
    const raw = sessionStorage.getItem("gridSignDocumentContext");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        console.log('[PrepareDocument] Retrieved context from sessionStorage', {
          pdfName: parsed.pdfName,
          templateId: parsed.templateId,
          recipientConfiguration: parsed.recipientConfiguration,
          recipientsCount: parsed.recipients?.length || 0,
          firstRecipients: (parsed.recipients || []).slice(0,3)
        });
        console.log('[PrepareDocument] CommonFields from context:', { count: (parsed.commonFields || []).length, sample: (parsed.commonFields || []).slice(0,3) });
        setCtx(parsed);
      } catch {
        setCtx(null);
      }
    }
  }, []);

  // When ctx becomes available, build workflowData once
  useEffect(() => {
    if (!ctx) return;
    // Preserve template fields for all use-template modes except CreateNewTemplate.
    // Use-template modes: FromTemplate, Mixed, CustomRecipients (templateId present)
  const shouldCarryTemplateFields = !!ctx.templateId && ctx.recipientConfiguration !== 'CreateNewTemplate';
    // StartImmediately rules:
    // 1. If launched from send-for-signatures (fromWorkflowTab === false) always default TRUE regardless of mode.
    // 2. If launched from workflow tab (fromWorkflowTab === true):
    //    - For CreateNewTemplate we default FALSE (allow user to prepare before sending).
    //    - For other modes default TRUE, but user can still toggle.
    if (!ctx.fromWorkflowTab) {
      setStartImmediately(true);
    } else {
      setStartImmediately(ctx.recipientConfiguration !== 'CreateNewTemplate');
    }
    // Helper stable ID (template recipients use templateRecipientId; custom recipients use index)
    const stableIdFor = (r: MappingContextRecipient, idx: number) => r.templateRecipientId != null ? `templ-${r.templateRecipientId}` : `cust-${idx}`;
    // First carry template-derived fields (for all recipients that have them), assign stableId
    const baseRecipients = ctx.recipients.map((r, idx) => ({
      email: r.email,
      name: r.name,
      deliveryType: r.deliveryType ?? 0,
      role: r.role,
      templateRecipientId: r.templateRecipientId ?? null,
      useDefaultUser: r.useDefaultUser ?? false,
      stableId: stableIdFor(r, idx),
      fields: shouldCarryTemplateFields ? (r.fields || []).map(f => ({
        fieldId: f.fieldId,
        fieldType: f.fieldType,
        fieldName: f.fieldName,
        position: f.position,
        isRequired: f.isRequired
      })) : []
    }));

    // For Mixed mode: custom recipients (templateRecipientId null) should still start with a cloned base set (optional design).
    if (ctx.recipientConfiguration === 'Mixed') {
      const templateFieldPool = baseRecipients.flatMap(r => r.fields);
      baseRecipients.forEach(r => {
        if (r.templateRecipientId == null && r.fields.length === 0 && templateFieldPool.length) {
          // Clone with new IDs to avoid collisions. Use a high offset.
          const offsetBase = 10000; // ensure no overlap with original template fieldIds
          r.fields = templateFieldPool.map((f, idx) => ({
            fieldId: offsetBase + idx,
            fieldType: f.fieldType,
            fieldName: f.fieldName,
            position: f.position,
            isRequired: f.isRequired
          }));
        }
      });
    }

    // For CustomRecipients (templateId present but no templateRecipientId): optionally copy first template recipient's fields (if any)
    if (ctx.recipientConfiguration === 'CustomRecipients') {
      const templateDerived = baseRecipients.filter(r => r.templateRecipientId != null && r.fields.length);
      const firstTemplateFields = templateDerived[0]?.fields || [];
      if (firstTemplateFields.length) {
        baseRecipients.forEach(r => {
          if (r.templateRecipientId == null && r.fields.length === 0) {
            const offsetBase = 20000;
            r.fields = firstTemplateFields.map((f, idx) => ({
              fieldId: offsetBase + idx,
              fieldType: f.fieldType,
              fieldName: f.fieldName,
              position: f.position,
              isRequired: f.isRequired
            }));
          }
        });
      }
    }

    // Prefer base64 data URL (ctx.pdfDataUrl) for viewer reliability across route transitions;
    // falls back to blob/object URL (ctx.pdfUrl) if data URL unavailable.
    const effectiveDocumentUrl = ctx.pdfDataUrl && ctx.pdfDataUrl.startsWith('data:')
      ? ctx.pdfDataUrl
      : ctx.pdfUrl;
    setWorkflowData({
      documentName: ctx.pdfName,
      documentUrl: effectiveDocumentUrl,
      recipients: baseRecipients
    });
    console.log('[PrepareDocument] Using documentUrl for viewer', {
      usedDataUrl: !!ctx.pdfDataUrl,
      urlType: effectiveDocumentUrl?.substring(0, 15),
      length: effectiveDocumentUrl?.length
    });
    console.log('[PrepareDocument] Recipients field summary:', baseRecipients.map(r => ({ stableId: (r as any).stableId, email: r.email, templateRecipientId: r.templateRecipientId, fieldCount: r.fields.length })));
  }, [ctx]);

  // Color generation for recipients
  const GOLDEN_ANGLE = 137.508;
  const hashString = (str: string) => {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = Math.imul(31, h) + str.charCodeAt(i) | 0;
    return h >>> 0;
  };
  const colorForRecipient = (identifier: string, index: number) => {
    const seed = (hashString(identifier) + index) % 1000;
    const hue = (seed * GOLDEN_ANGLE) % 360;
    return `hsl(${hue.toFixed(2)}, 72%, 54%)`;
  };

  // Prepare recipients for the field mapper
  const normalizeRoleLabel = (role: Role | string | undefined | null): string => {
    if (!role) return '';
    if (typeof role === 'string') return role.trim();
    // Role object per types/workflow.ts
    const base = role.role || '';
    // Optionally include priority if meaningful
    return base.trim();
  };
  const recipientsForMapper = useMemo(() => {
    if (!workflowData) return [] as Array<{id:string; email:string; name:string; color:string; role?: string; deliveryType?: number}>;
    const base = workflowData.recipients.map((r, idx) => ({
      id: (r as any).stableId || r.email,
      email: r.email,
      name: r.name,
      color: colorForRecipient((r as any).stableId || r.email, idx),
      role: normalizeRoleLabel(r.role),
      deliveryType: r.deliveryType
    }));
    // Inject synthetic Shared recipient (ALL) only when sequential signing disabled AND at least one common field candidate exists.
    // Determine presence of any template-derived common fields from ctx.recipients fields with duplicate field keys marked common earlier (not yet in ctx).
    // For now, we decide injection based on sequential signing disabled; field placement will create common fields under 'ALL'.
    if (!ctx?.isSequentialSigningEnabled) {
      // Use consistent gray color for shared/common recipient
      return [{ id: '__COMMON__', email: 'all@recipients', name: 'Shared', color: '#6b7280', role: 'Shared' }, ...base];
    }
    return base;
  }, [workflowData, isReadOnlyTemplate]);

  const [commonFields, setCommonFields] = useState<Array<{ fieldId: number; fieldType: string; fieldName: string; position: string; isRequired: boolean }>>([]);
  const handleFieldsUpdate = useCallback((fields: MapperUpdateField[]) => {
    setWorkflowData(prev => {
      if (!prev) return prev;
      // Group fields by recipientId
      const grouped = new Map<string, MapperUpdateField[]>();
      for (const f of fields) {
        if (!f.recipientId) continue;
        const list = grouped.get(f.recipientId) || [];
        list.push(f);
        grouped.set(f.recipientId, list);
      }
  // Extract common fields ONLY if sequential signing DISABLED
  const allowCommon = !ctx?.isSequentialSigningEnabled;
      const commonsMap = new Map<string, { fieldId: number; fieldType: string; fieldName: string; position: string; isRequired: boolean }>();
      for (const f of fields) {
        if (allowCommon && f.isCommon) {
          // Derive raw positional tokens (prefer direct numeric properties if present)
          let px = typeof f.x === 'number' ? f.x : NaN;
          let py = typeof f.y === 'number' ? f.y : NaN;
          let pPage = typeof f.page === 'number' ? f.page : NaN;
          let pW = typeof f.width === 'number' ? f.width : NaN;
          let pH = typeof f.height === 'number' ? f.height : NaN;
          if (Number.isNaN(px) || Number.isNaN(py)) {
            const parts = f.position.split(',').map(p => p.trim());
            if (parts.length >= 2) {
              const tx = parseFloat(parts[0]); const ty = parseFloat(parts[1]);
              if (!Number.isNaN(tx)) px = tx; if (!Number.isNaN(ty)) py = ty;
            }
            if (parts.length >= 3) {
              const tPage = parseInt(parts[2]); if (!Number.isNaN(tPage)) pPage = tPage;
            }
            if (parts.length >= 5) {
              const tW = parseFloat(parts[3]); const tH = parseFloat(parts[4]);
              if (!Number.isNaN(tW)) pW = tW; if (!Number.isNaN(tH)) pH = tH;
            }
          }
          const key = f.commonGroupId || `${f.fieldType}:${px}:${py}:${pPage}`;
          if (!commonsMap.has(key)) {
            commonsMap.set(key, {
              fieldId: f.fieldId,
              fieldType: f.fieldType,
              fieldName: f.fieldName,
              // Use encoded position string as-is (already normalized by mapper)
              position: f.position,
              isRequired: f.isRequired
            });
          }
        }
      }
  setCommonFields(allowCommon ? Array.from(commonsMap.values()) : []);
      return {
        ...prev,
        recipients: prev.recipients.map(r => {
          const sid = (r as any).stableId || r.email;
          return {
            ...r,
            fields: grouped.get(sid) || []
          };
        })
      };
    });
  }, []);

  // Handle sending the workflow
  const handleSendWorkflow = () => {
    if (!workflowData || !ctx) return Promise.resolve(false);
    if (isSubmitting) return Promise.resolve(false);
    setIsSubmitting(true);

    // Build recipient payload matching earlier pattern
    const recipientsPayload = workflowData.recipients.map(r => ({
      email: r.email,
      name: r.name,
      deliveryType: r.deliveryType,
      role: r.role,
      // Only include TemplateRecipientId if non-null; backend validation expects presence for template-derived rows
      ...(ctx.templateId && r.templateRecipientId != null ? { templateRecipientId: r.templateRecipientId } : {}),
      useDefaultUser: r.useDefaultUser ?? false,
      fields: r.fields.map(f => ({
        fieldId: f.fieldId,
        fieldType: f.fieldType,
        fieldName: f.fieldName,
        position: f.position,
        isRequired: f.isRequired
      }))
    }));

    // Enforce at least one field (recipient-specific OR common)
    if (!(recipientsPayload.some(r => r.fields.length > 0) || commonFields.length > 0)) {
      toast.error('Please add at least one field (recipient or All Recipients) before sending.');
      return Promise.resolve(false);
    }

    // Map RecipientConfiguration string to backend enum numeric expected values (assumed order):
    // FromTemplate=0, CustomRecipients=1, Mixed=2, CreateNewTemplate=3
    const rcMap: Record<string, number> = { FromTemplate: 0, CustomRecipients: 1, Mixed: 2, CreateNewTemplate: 3 };
    const fv = ctx.formValues || {};
    const reminderDaysValue = (fv.reminderDays && /^\d+$/.test(fv.reminderDays)) ? parseInt(fv.reminderDays, 10) : 2;
    const rcValue = ctx.recipientConfiguration ? rcMap[ctx.recipientConfiguration] ?? 0 : 0;
    // Build DTO preview object for logging / potential JSON submission (excluding file which requires FormData)
    // Normalize ValidTill to YYYY-MM-DD (strip time if user agent inserted it)
    const validTillRaw = fv.agreementValidUntil || '';
    const validTill = validTillRaw.includes('T') ? validTillRaw.split('T')[0] : validTillRaw;
    const docNameInput = (fv.documentName && typeof fv.documentName === 'string' && fv.documentName.trim() !== '') ? fv.documentName.trim() : ctx.pdfName;
    const dto: CreateWorkflowDto = {
      RecipientConfiguration: rcValue,
      TemplateId: ctx.templateId || undefined,
      ValidTill: validTill,
      AutoRemainder: !!fv.autoReminder,
      ReminderIntervalDays: reminderDaysValue,
      IsSequentialSigningEnabled: !!fv.sendInOrder,
      DocumentName: docNameInput,
      Description: (fv.description && fv.description.trim() !== '') ? fv.description : 'please sign the document',
      RecipientMessage: fv.noteToRecipients || '',
      Recipients: recipientsPayload,
  CommonFields: commonFields,
      StartImmediately: startImmediately,
    };
    // Helpful debug preview before constructing FormData
    console.log('CreateWorkflowDto preview:', dto);

    const fd = new FormData();
    if (ctx.pdfDataUrl) {
      try {
        const match = ctx.pdfDataUrl.match(/^data:(.*?);base64,(.*)$/);
        if (match) {
          const mime = match[1] || 'application/pdf';
          const b64 = match[2];
          const binary = atob(b64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          const blob = new Blob([bytes], { type: mime });
          const fileObj = new File([blob], ctx.pdfName, { type: mime });
          // Backend expects key 'document' for file per validation error; preserve name separately
          fd.append('document', fileObj);
          fd.append('DocumentName', docNameInput);
        }
      } catch (e) {
        console.error('File reconstruction failed:', e);
        toast.error('Failed to reconstruct PDF file.');
        return Promise.resolve(false);
      }
    } else {
      toast.error('Missing PDF data.');
      return Promise.resolve(false);
    }

    // Append DTO fields to FormData (excluding file already appended)
    fd.append('ValidTill', dto.ValidTill);
    fd.append('AutoRemainder', String(dto.AutoRemainder));
    fd.append('ReminderIntervalDays', String(dto.ReminderIntervalDays));
    fd.append('IsSequentialSigningEnabled', String(dto.IsSequentialSigningEnabled));
    fd.append('Description', dto.Description || '');
    fd.append('RecipientMessage', dto.RecipientMessage || '');
  fd.append('recipients', JSON.stringify(dto.Recipients));
  fd.append('commonFields', JSON.stringify(dto.CommonFields));
    fd.append('RecipientConfiguration', String(dto.RecipientConfiguration));
    if (dto.TemplateId) fd.append('TemplateId', String(dto.TemplateId));
    fd.append('StartImmediately', dto.StartImmediately ? 'true' : 'false');

    const baseUrl = process.env.NEXT_PUBLIC_LOCAL_API_URL || 'http://localhost:3000';
    const endpoint = `${baseUrl}/workflow/createWorkflow`;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      toast.error('You are not authenticated. Please login again.');
      return Promise.resolve(false);
    }

    return axios.post(endpoint, fd, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` })
      },
      withCredentials: true
    }).then(res => {
      console.log('Workflow create response:', res.data);
      console.log('Sent FormData Recipients:', JSON.stringify(recipientsPayload, null, 2));
      const apiStatus = (res.data as any)?.status;
      const apiMessage = (res.data as any)?.message;
      if (apiStatus === 'success') {
        toast.success(apiMessage || 'Workflow Created Successfully');
        // Slight delay so user sees toast before navigation
        setTimeout(() => router.push('/'), 600);
        return true;
      } else {
        toast.error(apiMessage || 'Workflow creation failed');
        return false;
      }
    }).catch((err: AxiosError) => {
      if (err.response?.status === 401) {
        toast.error('Unauthorized (401). Please login again.');
        // Optionally redirect after a short delay
        setTimeout(() => { window.location.href = '/'; }, 1500);
      } else {
        console.error('Workflow creation failed', err);
        const message = (err.response?.data as any)?.message || 'Workflow creation failed';
        toast.error(message);
      }
      return false;
    }).finally(() => {
      setIsSubmitting(false);
    });
  };

  // New handler for template creation after field mapping
  const handleCreateTemplate = () => {
    if (!workflowData || !ctx || !ctx.isTemplateCreation) return Promise.resolve(false);
    if (isSubmitting) return Promise.resolve(false);
    setIsSubmitting(true);
    const fv = ctx.formValues || {};
    // Validate at least one field across recipients
  const anyFields = workflowData.recipients.some(r => (r.fields || []).length > 0) || commonFields.length > 0;
    if (!anyFields) {
      toast.error('Please add at least one field (recipient or All Recipients) before creating the template.');
      setIsSubmitting(false);
      return Promise.resolve(false);
    }
    // Validate recipients completeness
    const allRecipientsComplete = workflowData.recipients.every(r => r.email && r.name && r.role && (r.role as any).roleId > 0);
    if (!allRecipientsComplete) {
      toast.error('Fill name, email, and designation for every recipient before creating the template.');
      setIsSubmitting(false);
      return Promise.resolve(false);
    }
    const recipientsPayload = workflowData.recipients.map(r => ({
      email: r.email,
      name: r.name,
      deliveryType: r.deliveryType ?? 0,
      role: r.role,
      fields: (r.fields || []).map(f => ({
        fieldId: f.fieldId,
        fieldType: f.fieldType,
        fieldName: f.fieldName,
        position: f.position,
        isRequired: f.isRequired
      }))
    }));
    // Reconstruct PDF file from data URL
    if (!ctx.pdfDataUrl) {
      toast.error('Missing PDF data.');
      setIsSubmitting(false);
      return Promise.resolve(false);
    }
    let fileObj: File | null = null;
    try {
      const match = ctx.pdfDataUrl.match(/^data:(.*?);base64,(.*)$/);
      if (match) {
        const mime = match[1] || 'application/pdf';
        const b64 = match[2];
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mime });
        fileObj = new File([blob], ctx.pdfName, { type: mime });
      }
    } catch (e) {
      console.error('Template file reconstruction failed', e);
      toast.error('Failed to reconstruct PDF file.');
      setIsSubmitting(false);
      return Promise.resolve(false);
    }
    if (!fileObj) {
      toast.error('Failed to reconstruct PDF file.');
      setIsSubmitting(false);
      return Promise.resolve(false);
    }
    const fd = new FormData();
    const docNameInput = (fv.documentName && typeof fv.documentName === 'string' && fv.documentName.trim() !== '') ? fv.documentName.trim() : ctx.pdfName;
    fd.append('DocumentName', docNameInput);
    fd.append('Description', (fv.description && fv.description.trim() !== '') ? fv.description : 'Please sign this document');
    fd.append('RecipientMessage', fv.noteToRecipients || 'Kindly sign before deadline');
    fd.append('IsSequentialSigningEnabled', String(!!fv.sendInOrder));
  // For template creation include commonFields gathered during mapping
  fd.append('recipients', JSON.stringify(recipientsPayload));
  fd.append('commonFields', JSON.stringify(commonFields));
    fd.append('document', fileObj, fileObj.name);
    const baseUrl = process.env.NEXT_PUBLIC_LOCAL_API_URL || 'http://localhost:3000';
    const endpoint = `${baseUrl}/template/createTemplate`;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!token) {
      toast.error('You are not authenticated. Please login again.');
      setIsSubmitting(false);
      return Promise.resolve(false);
    }
    return fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    }).then(async res => {
      let data: any = {};
      try { data = await res.json(); } catch {}
      const apiStatus = data?.status;
      const apiMessage = data?.message;
      if (res.ok && apiStatus === 'success') {
        toast.success(apiMessage || 'Template Created Successfully');
        setTimeout(() => router.push('/templates'), 600);
        return true;
      } else {
        toast.error(apiMessage || 'Template creation failed');
        return false;
      }
    }).catch(err => {
      console.error('Template creation failed', err);
      toast.error('Template creation failed');
      return false;
    }).finally(() => {
      setIsSubmitting(false);
    });
  };

  const pathname = usePathname();
  // Removed right-side navigation items per UX simplification request.
  // Determine read-only status for any use-template workflow (templateId present, not creating a new template)
  // (isReadOnlyTemplate declared earlier for dependency ordering)
  // Build preset fields for read-only rendering when FromTemplate; always call hook (return empty early if ctx/workflowData not ready)
  const presetFields = useMemo(() => {
    if (!ctx || !workflowData) return [] as any[];
    if (!(ctx.templateId && ctx.recipientConfiguration !== 'CreateNewTemplate')) return [] as any[];
    const out: { id: number | null; key: string; type: string; required: boolean; x: number; y: number; page: number | null; width: number | null; height: number | null; recipientId: string | null; isCommon?: boolean; commonGroupId?: string }[] = [];
    let fieldSeq = 0;
    // We now rely on backend-supplied commonFields in ctx if present (added to session storage in template-details page).
    const backendCommon: any[] = (ctx as any).commonFields || [];
    const sharedRecipientId = '__COMMON__';
    const commonDedup = new Map<string, { f: any; x: number; y: number; page: number | null; width: number | null; height: number | null }>();
    const parsePosition = (pos: string | undefined, fallbackIndex: number) => {
      let x: number | null = null; let y: number | null = null; let page: number | null = null; let width: number | null = null; let height: number | null = null;
      if (pos && pos.includes(',')) {
        const parts = pos.split(',').map(p => p.trim());
        const px = parseFloat(parts[0]); const py = parts.length>1 ? parseFloat(parts[1]) : NaN;
        if (!Number.isNaN(px)) x = px; if (!Number.isNaN(py)) y = py;
        if (parts.length >= 3) { const pPage = parseInt(parts[2]); if (!Number.isNaN(pPage)) page = pPage; }
        if (parts.length >= 5) { const pW = parseFloat(parts[3]); const pH = parseFloat(parts[4]); if (!Number.isNaN(pW)) width = pW; if (!Number.isNaN(pH)) height = pH; }
      }
      if (x === null) x = 40 + (fallbackIndex * 20);
      if (y === null) y = 60 + (fallbackIndex * 15);
      return { x, y, page, width, height };
    };
    // Insert backend common fields first if sequential signing disabled
    if (!ctx.isSequentialSigningEnabled && backendCommon.length) {
      backendCommon.forEach((f, idx) => {
        const { x, y, page, width, height } = parsePosition(f.position, fieldSeq + idx);
        out.push({
          id: f.fieldId ?? f.id ?? null,
          key: f.fieldName ?? f.key ?? 'Field',
          type: f.fieldType ?? f.type ?? 'text',
          required: !!(f.isRequired ?? f.required),
          x: x!,
          y: y!,
          page,
          width: width ?? null,
          height: height ?? null,
          recipientId: sharedRecipientId,
          isCommon: true,
          commonGroupId: `cmn-pre-${f.fieldId ?? f.id ?? idx}`
        });
      });
      fieldSeq += backendCommon.length;
    }
    // Then recipient-specific fields only
    workflowData.recipients.forEach(rec => {
      rec.fields.forEach(f => {
        if ((f as any).isCommonField) return; // skip if flagged common by backend
        const { x, y, page, width, height } = parsePosition(f.position, fieldSeq);
        out.push({
          id: f.fieldId,
          key: f.fieldName,
          type: f.fieldType || 'text',
          required: f.isRequired,
          x: x!,
          y: y!,
          page,
          width: width ?? null,
          height: height ?? null,
          recipientId: (rec as any).stableId || rec.email
        });
        fieldSeq++;
      });
    });
    console.log('[PrepareDocument] presetFields built', { count: out.length, sample: out.slice(0,3) });
    return out;
  }, [ctx, workflowData, isReadOnlyTemplate]);

  if (!ctx || !workflowData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-sm text-muted-foreground">{!ctx ? 'Loading context…' : 'Preparing workflow…'}</p>
        <Button onClick={() => (window.location.href = "/")}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col">
      {isReadOnlyTemplate && (
        <div className="fixed top-16 left-4 z-50 flex items-center gap-2 px-3 py-1 rounded-md bg-amber-500/90 text-white shadow-lg ring-1 ring-amber-600/40">
          <span className="text-xs font-semibold tracking-wide">Template Locked</span>
          <span className="text-[10px] opacity-90">Fields are read-only</span>
        </div>
      )}
      {/* Top branding bar */}
      <div className="fixed top-0 left-0 right-0 flex items-center justify-between px-4 h-14 border-b border-border bg-background/95 backdrop-blur z-50">
        {/* Left section: Back button + Title */}
        <div className="flex items-center gap-3 min-w-0">
          <BackButton ariaLabel="Go Back" onClick={() => {
            if (window.history.length > 1) {
              router.back();
            } else {
              router.push('/templates');
            }
          }} size="icon" />
          <div className="flex flex-col leading-tight truncate">
            <span className="text-sm font-semibold truncate">Prepare Document</span>
            <span className="text-[11px] text-muted-foreground truncate max-w-[180px] sm:max-w-xs">{ctx.pdfName || 'Untitled PDF'}</span>
          </div>
        </div>
        {/* Center: Logo (optional) */}
        <div className="flex items-center justify-center">
          <BrandLogo className="h-10 w-auto" />
        </div>
        {/* Right section intentionally left empty (nav removed) */}
        <div className="flex items-center justify-end w-24" />
      </div>
      {/* Existing app global navbar (optional) */}
      {/* We can optionally render the full Navbar if needed below the branding bar */}
      {/* <Navbar /> */}
      <div className="flex-1 min-h-0 pt-14">
          <DocumentFieldMapper
            pdfUrl={workflowData.documentUrl || ''}
            recipients={recipientsForMapper}
            hasHeaderBar
            onFieldsUpdate={isReadOnlyTemplate ? undefined : handleFieldsUpdate}
            onSend={ctx.isTemplateCreation ? handleCreateTemplate : handleSendWorkflow}
            sendLabel={ctx.isTemplateCreation ? 'Create Template' : 'Send Document'}
            readOnly={isReadOnlyTemplate}
            hideInternalZoomControls={true}
            presetFields={presetFields}
            // Enable preset field injection for Mixed & CustomRecipients so cloned fields appear even if not template-derived
            alwaysInjectPresetFields={ctx.recipientConfiguration === 'Mixed' || ctx.recipientConfiguration === 'CustomRecipients'}
            showRecipientFilterDock={isReadOnlyTemplate}
            allowRecipientFilteringInReadOnly={true}
          />
          {/* Workflow creation panel (only for use-template mode) */}
          {ctx.templateId && (
            <div className="fixed bottom-4 right-4 z-40 flex flex-col gap-3 p-4 rounded-lg border border-border bg-background/95 backdrop-blur shadow-xl w-72">
              <h3 className="text-sm font-semibold">{isReadOnlyTemplate ? 'Review & Create Workflow' : 'Create Workflow'}</h3>
              <p className="text-[11px] text-muted-foreground">{isReadOnlyTemplate ? 'Template locked: choose start mode then create.' : 'Choose whether the workflow starts immediately.'}</p>
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border border-border accent-primary"
                  checked={startImmediately}
                  onChange={e => setStartImmediately(e.target.checked)}
                  disabled={isSubmitting}
                />
                <span>Start immediately</span>
              </label>
              <Button
                variant="default"
                disabled={isSubmitting || !workflowData}
                onClick={() => { handleSendWorkflow(); }}
                className="w-full justify-center"
              >
                {isSubmitting ? 'Creating...' : 'Create Workflow'}
              </Button>
              {!startImmediately && (
                <p className="text-[10px] text-muted-foreground leading-tight">Will be saved as draft (not sent to recipients yet).</p>
              )}
            </div>
          )}
          {/* Removed separate template creation panel to consolidate action in top bar button */}
      </div>
    </div>
  );
};

export default PrepareDocumentPage;