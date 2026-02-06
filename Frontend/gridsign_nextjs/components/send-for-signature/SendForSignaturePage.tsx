"use client";

// Moved into grouped folder: send-for-signature/SendForSignaturePage.tsx
// (Original path was components/SendForSignaturePage.tsx)

import React, { useState, useRef, useEffect } from "react";
import { formatDateDDMMYYYY } from '@/lib/utils';
import Image from "next/image";
import pdf from "@/public/pdf.svg";
import { useDropzone } from "react-dropzone";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Check, Trash2, Plus, Upload, FileText, ChevronDown, ChevronUp, UserCheck, UserCog } from "lucide-react";
import { usePost } from "@/hooks/useFetch";
import { toast } from "sonner";
import { useApiQuery } from "@/hooks/useApiQuery";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

// Validation schema
const formSchema = z.object({
  documentName: z.string().min(1, "Document name is required"),
  sendInOrder: z.boolean(),
  addMe: z.boolean(),
  agreementValidUntil: z.string().optional(),
  documentType: z.string().optional(),
  description: z.string().optional(),
  autoReminder: z.boolean(),
  reminderDays: z.string().optional(),
  noteToRecipients: z.string().optional(),
});

type Designation = { name: string; priority: number; roleId: number };

// Lightweight API response shape used by role creation endpoint
type ApiResponse = {
  status: 'success' | 'error' | 'warning' | string;
  message?: string;
  data?: any;
};

type Recipient = {
  email: string;
  name: string;
  deliveryType: number;
  role: { roleId: number; role: string; rolePriority: number };
  fields: { fieldId: number; fieldType: string; fieldName: string; position: string; isRequired: boolean }[];
  isMe?: boolean; // flag to identify auto-added current user recipient
  // Index referencing original template recipient ordering (stable identity) when in use-template mode
  templateSourceIndex?: number;
  // Backend linkage id for template-derived recipient
  templateRecipientId?: number | null;
  // Indicates whether current identity matches template defaults (Mixed mode toggle)
  useDefaultUser?: boolean;
};

const getDefaultValidityDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 10);
  return date.toISOString().split("T")[0];
};

interface SendForSignatureProps {
  // modeOverride 'template' forces template creation flow
  // modeOverride 'use-template' initiates workflow from existing template with configurable recipient strategy
  // absence of override uses legacy send-for-signature labeling
  modeOverride?: 'workflow-create' | 'template' | 'use-template';
  templateId?: string | null; // provided when modeOverride === 'use-template'
  onCancelEmbed?: () => void; // when embedded template creation cancelled
  // New: pass already-deduplicated common fields from template details to ensure prepare-document sees them.
  commonFieldsOverride?: Array<{ fieldId?: number | null; fieldType?: string; fieldName?: string; position?: string | null; isRequired?: boolean }>; 
}

const SendForSignaturePage: React.FC<SendForSignatureProps> = ({ modeOverride, templateId, onCancelEmbed, commonFieldsOverride }) => {
  const [showInput, setShowInput] = useState(false);
  const [newDesignation, setNewDesignation] = useState("");
  const [newPriority, setNewPriority] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [userDetails, setUserDetails] = useState<{ fname?: string; lname?: string; email?: string } | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const modeParam = searchParams?.get('mode');
  const derivedMode = modeParam === 'template' || pathname.startsWith('/templates/create') ? 'template' : 'workflow';
  // internal mode: 'template' or 'workflow'
  const baseMode = derivedMode;
  const mode = modeOverride === 'template' ? 'template' : 'workflow';
  const isWorkflowCreation = modeOverride === 'workflow-create' || modeOverride === 'use-template';
  const isUseTemplateMode = modeOverride === 'use-template' && !!templateId;
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Removed inline recipient field editing; field mapping now occurs only in Prepare Document stage.
  // Recipient configuration (use-template mode)
  type RecipientConfiguration = 'FromTemplate' | 'CustomRecipients' | 'Mixed' | 'CreateNewTemplate';
  // Full set of recipient configuration modes
  const recipientConfigOptionsAll: { key: RecipientConfiguration; label: string; description: string }[] = [
    { key: 'FromTemplate', label: 'From Template', description: 'Use only the recipients defined in the existing template.' },
    { key: 'CustomRecipients', label: 'Custom Only', description: 'Ignore any template recipients; specify a brand new list.' },
    { key: 'Mixed', label: 'Mixed', description: 'Start with template recipients and add or override with custom recipients.' },
    { key: 'CreateNewTemplate', label: 'Create Template', description: 'Create a brand new template from this document; recipients you add will become template defaults.' }
  ];
  // When using an existing template, hide the CreateNewTemplate option; when creating a workflow from scratch expose it & default to it.
  const recipientConfigOptions = (modeOverride === 'use-template' || isUseTemplateMode)
    ? recipientConfigOptionsAll.filter(o => o.key !== 'CreateNewTemplate')
    : recipientConfigOptionsAll;
  // Default: if we're NOT using an existing template, we start in CreateNewTemplate mode to build a new template from this workflow.
  const initialRecipientConfig: RecipientConfiguration = !isUseTemplateMode ? 'CreateNewTemplate' : 'FromTemplate';
  const [recipientConfiguration, setRecipientConfiguration] = useState<RecipientConfiguration>(initialRecipientConfig);
  const [templateRecipientsLoaded, setTemplateRecipientsLoaded] = useState(false);
  const [templateMeta, setTemplateMeta] = useState<{
    name?: string;
    description?: string;
    ownerName?: string;
    ownerEmail?: string;
    totalRecipients?: number;
    totalFields?: number;
    totalFiles?: number;
    usageCount?: number;
    isSequentialSigningEnabled?: boolean;
  } | null>(null);
  const fetchInFlightRef = useRef(false); // guard against duplicate template detail fetches
  const originalTemplateRecipientsRef = useRef<Recipient[] | null>(null); // cache of pristine template recipients

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      documentName: "",
      sendInOrder: true,
  addMe: false,
  autoReminder: true,
      reminderDays: "2",
      agreementValidUntil: getDefaultValidityDate(),
    },
  });

  const { loading: addingRole, execute: addRecipientRole } = usePost<ApiResponse>({
    onSuccess: (response) => {
      if (response.status === "success") toast.success(response.message || "Designation added successfully");
      else if (response.status === "error") toast.error(response.message || "Failed to add designation");
      else if (response.status === "warning") toast.warning(response.message);
      else toast.info(response.message);
    },
    onError: (error) => {
      console.error("Error adding designation:", error);
      const errorData = error.response?.data as ApiResponse | undefined;
      toast.error(errorData?.message || "Failed to add designation. Please try again.");
    },
  });

  const baseURL = process.env.NEXT_PUBLIC_LOCAL_API_URL || "http://localhost:3000";

  const { data: apiResponse, isLoading: loadingDesignations, error, refetch: refreshDesignations } = useApiQuery<Designation[]>({
    queryKey: ["recipientRoles"],
    url: `${baseURL}/workflow/getRecipientRoles`,
    transform: (response: any) => {
      if (response.$values) {
        return response.$values.map((item: any) => ({ name: item.role, roleId: item.roleId, priority: item.rolePriority }));
      }
      return [];
    },
  });
  const designations = apiResponse?.data ?? [];

  // Fetch user details directly if not cached
  useEffect(() => {
    try { setToken(localStorage.getItem('token')); } catch { setToken(null); }
  }, []);

  const { data: fetchedUser, isLoading: loadingUser } = useApiQuery<{ fname: string; lname: string; email: string }>({
    queryKey: ['user-details-inline'],
    url: `${process.env.NEXT_PUBLIC_API_URL || baseURL}/user/getUserDetails`,
    enabled: !!token,
    staleTime: 1000 * 60 * 5,
    config: { headers: { 'Content-Type': 'application/json' } }
  });

  // Consolidate user details: prefer localStorage first, else fetched
  useEffect(() => {
    let fromStorage: any = null;
    try {
      const raw = localStorage.getItem('user-details');
      if (raw) {
        const parsed = JSON.parse(raw);
        fromStorage = parsed?.data || parsed;
      }
    } catch {}
    if (fromStorage && (fromStorage.email || fromStorage.fname)) {
      setUserDetails(fromStorage);
    } else if (fetchedUser?.data) {
      setUserDetails(fetchedUser.data);
      try { localStorage.setItem('user-details', JSON.stringify(fetchedUser)); } catch {}
    } else if (fetchedUser && !fetchedUser.data) {
      // API returned but shape unexpected
      setUserDetails(fetchedUser as any);
    }
  }, [fetchedUser]);

  const handleAddRecipient = () => setRecipients(prev => [...prev, { email: "", name: "", deliveryType: 0, role: { roleId: 0, role: "", rolePriority: 0 }, fields: [], isMe: false, templateRecipientId: null, useDefaultUser: false }]);
  // Wrapper enforcing max recipients when in CustomRecipients mode
  const maxTemplateRecipients = templateMeta?.totalRecipients || (originalTemplateRecipientsRef.current?.length || 0);
  const canAddMoreCustom = !isUseTemplateMode || recipientConfiguration !== 'CustomRecipients' || recipients.length < maxTemplateRecipients;
  const tryAddCustomRecipient = () => {
    if (!canAddMoreCustom) {
      toast.error(`Limit reached: template allows ${maxTemplateRecipients} recipient${maxTemplateRecipients===1?'':'s'}.`);
      return;
    }
    handleAddRecipient();
  };

  const handleRemoveRecipient = (index: number) => {
    setRecipients(prev => {
      const removed = prev[index];
      const next = prev.filter((_, i) => i !== index);
      if (removed && (removed.isMe || (userDetails?.email && removed.email === userDetails.email))) {
        // If the self-added recipient is removed, uncheck the Add Me box
        form.setValue('addMe', false, { shouldDirty: true });
      }
      return next;
    });
  };

  const handleRecipientChange = (index: number, field: keyof Recipient, value: any) => {
    setRecipients(prev => prev.map((r, i) => {
      if (i !== index) return r;
      if (field === "role") {
        const designation = designations.find(d => d.name === value);
        if (designation) {
          return { ...r, role: { roleId: designation.roleId, role: designation.name, rolePriority: designation.priority } };
        }
        return r;
      }
      return { ...r, [field]: value } as Recipient;
    }));
  };

  const [preloadedFile, setPreloadedFile] = useState<File | null>(null);
  // Guard to avoid duplicate file resource fetch attempts
  const fileResourceFetchedRef = useRef(false);
  // Determine if template-locked mode BEFORE initializing dropzone so we can disable it
  const isFromTemplateLocked = isUseTemplateMode && recipientConfiguration === 'FromTemplate';
  const { getRootProps, getInputProps, acceptedFiles, open: openFileDialog } = useDropzone({
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: isFromTemplateLocked,
    noClick: false,
    noKeyboard: true,
  });

  const toBase64 = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader(); reader.onload = () => resolve(reader.result as string); reader.onerror = reject; reader.readAsDataURL(file);
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (isSubmitting) return;
    const chosenFile = acceptedFiles[0] || preloadedFile;
    if (!chosenFile) { toast.error("Please upload a PDF before continuing"); return; }
    if (mode === 'template') {
      const completeRecipients = recipients.filter(r => r.email && r.name && r.role.roleId > 0);
      if (completeRecipients.length === 0) { toast.error('Add at least one complete recipient (name, email, role)'); return; }
    }
    const pdfFile = chosenFile;
    // Unified path: for template creation we now route to prepare-document for field mapping instead of immediate API call
    const pdfUrl = URL.createObjectURL(pdfFile);
    let pdfDataUrl: string | null = null;
    try { pdfDataUrl = await toBase64(pdfFile); } catch { toast.error("Failed to read PDF file"); return; }
    // Additional validations / enhancements
    // 1. ValidTill must be >= today if provided
    if (values.agreementValidUntil) {
      const today = new Date(); today.setHours(0,0,0,0);
      const selected = new Date(values.agreementValidUntil + 'T00:00:00');
      if (selected.getTime() < today.getTime()) {
        toast.error('Validity date must not be in the past');
        return;
      }
    }
    // 2. Mixed mode must retain at least one template identity (useDefaultUser true)
    if (isUseTemplateMode && recipientConfiguration === 'Mixed') {
      const hasTemplateIdentity = recipients.some(r => r.useDefaultUser);
      if (!hasTemplateIdentity) {
        toast.error('Mixed mode requires at least one template recipient identity retained.');
        return;
      }
    }
    // Validate recipients (workflow mode): ensure name, email, role selected
    const allWorkflowRecipientsComplete = recipients.every(r => r.email && r.name && r.role && r.role.roleId > 0);
    if (mode === 'workflow' && !allWorkflowRecipientsComplete) {
      toast.error('Fill name, email, and designation for every recipient before continuing');
      return;
    }

    // Helper to construct workflow payload preview (without file) for downstream use
    const rcMap: Record<RecipientConfiguration, number> = { FromTemplate: 0, CustomRecipients: 1, Mixed: 2, CreateNewTemplate: 3 } as const;
    const dtoPreview = {
      RecipientConfiguration: rcMap[recipientConfiguration],
      TemplateId: isUseTemplateMode ? templateId : null,
      ValidTill: values.agreementValidUntil || '',
      AutoRemainder: !!values.autoReminder,
      ReminderIntervalDays: (values.reminderDays && /^\d+$/.test(values.reminderDays)) ? parseInt(values.reminderDays,10) : 2,
      IsSequentialSigningEnabled: !!values.sendInOrder,
      DocumentName: values.documentName || pdfFile.name,
      Description: (values.description && values.description.trim() !== '') ? values.description : 'please sign the document',
      RecipientMessage: values.noteToRecipients || '',
      Recipients: recipients.map(r => ({
        email: r.email,
        name: r.name,
        deliveryType: r.deliveryType,
        role: r.role,
        templateRecipientId: isUseTemplateMode ? (r.templateRecipientId ?? null) : null,
        useDefaultUser: r.useDefaultUser ?? false,
        fields: (r.fields || []).map(f => ({ fieldId: f.fieldId, fieldType: f.fieldType, fieldName: f.fieldName, position: f.position, isRequired: f.isRequired }))
      })),
      CommonFields: [],
      StartImmediately: true // will be recalculated in prepare-document context
    };
  // Debug preview removed
    // Include workflow creation source flag so prepare-document can set StartImmediately appropriately
    // Hydrate template fields for recipients that are template-linked but currently have no fields
    let hydratedRecipients = recipients;
    if (isUseTemplateMode && (recipientConfiguration === 'CustomRecipients' || recipientConfiguration === 'Mixed')) {
      // Collect base template fields from any template recipient (useDefaultUser true OR templateRecipientId matches)
      const templateFieldPool = recipients
        .filter(r => r.templateRecipientId != null && (r.fields && r.fields.length > 0))
        .flatMap(r => r.fields || []);
      if (templateFieldPool.length) {
        hydratedRecipients = recipients.map(r => {
          if (r.templateRecipientId != null && (!r.fields || r.fields.length === 0)) {
            // Clone with offset to avoid ID collisions
            const baseOffset = 50000 + (r.templateRecipientId * 1000);
            const cloned = templateFieldPool.map((f, i) => ({
              fieldId: baseOffset + i,
              fieldType: f.fieldType,
              fieldName: f.fieldName,
              position: f.position,
              isRequired: f.isRequired
            }));
            return { ...r, fields: cloned };
          }
          return r;
        });
        // Hydration debug removed
      } else {
  // No template field pool; silent
      }
    }
    const effectiveRecipientConfiguration: RecipientConfiguration = !isUseTemplateMode ? 'CreateNewTemplate' : recipientConfiguration;
    if (effectiveRecipientConfiguration !== recipientConfiguration) {
      // Update state only if it differs (avoids extra renders mid-submit)
      setRecipientConfiguration(effectiveRecipientConfiguration);
    }
    const recipientDebug = hydratedRecipients.map((r, idx) => ({
      idx,
      email: r.email,
      name: r.name,
      role: r.role?.role || r.role,
      templateRecipientId: r.templateRecipientId ?? null,
      useDefaultUser: r.useDefaultUser ?? false,
      fieldCount: (r.fields || []).length,
      fieldsSample: (r.fields || []).slice(0,3).map(f => ({ id: f.fieldId, type: f.fieldType, pos: f.position }))
    }));
    // Export debug removed
    // Gather backend-provided commonFields (deduplicated) from template details if available via prop or external context.
    // We look for a global injected variable or window object property if template details page passed it, else empty.
    let commonFields: any[] = [];
    let commonSource: 'override' | 'injected' | 'fallback' | 'none' = 'none';
    // Prefer explicit override prop from template details page
    if (isUseTemplateMode && Array.isArray(commonFieldsOverride) && commonFieldsOverride.length) {
      commonFields = commonFieldsOverride;
      commonSource = 'override';
    } else {
      try {
        if (typeof window !== 'undefined') {
          const injected = (window as any).__TEMPLATE_COMMON_FIELDS__;
          const fallback = (window as any).__TEMPLATE_COMMON_FIELDS_FALLBACK__;
          if (Array.isArray(injected) && injected.length) {
            commonFields = injected;
            commonSource = 'injected';
          } else if (Array.isArray(fallback) && fallback.length) {
            commonFields = fallback;
            commonSource = 'fallback';
          }
        }
      } catch {}
    }
    // Validation: require at least one recipient before proceeding
    if (!hydratedRecipients || hydratedRecipients.length === 0) {
      toast.error('Add at least one recipient before preparing the document');
      return;
    }
    // Validation: require a non-empty document name (user-entered or auto-filled from file). Empty string disallowed.
    const trimmedDocName = (values.documentName || '').trim();
    if (!trimmedDocName) {
      toast.error('Enter a document name before proceeding');
      return;
    }
    const context = { pdfName: pdfFile.name, pdfUrl, pdfDataUrl, recipients: hydratedRecipients, formValues: { ...values, documentName: trimmedDocName }, fromWorkflowTab: isWorkflowCreation, templateId: isUseTemplateMode ? templateId : null, recipientConfiguration: effectiveRecipientConfiguration, dtoPreview, isTemplateCreation: mode === 'template', commonFields };
    console.log('[SendForSignature] Context saved with recipientConfiguration:', effectiveRecipientConfiguration);
    console.log('[SendForSignature] CommonFields included:', { count: commonFields.length, source: commonSource, sample: commonFields.slice(0,3) });
    sessionStorage.setItem("gridSignDocumentContext", JSON.stringify(context));
    router.push("/prepare-document");
  };

  const handleAddDesignation = async () => {
    const trimmed = newDesignation.trim();
    const priorityNumber = parseInt(newPriority);
    if (!trimmed) { toast.error("Designation name cannot be empty"); return; }
    if (designations.some(d => d.name === trimmed)) { toast.error("This designation already exists"); return; }
    if (isNaN(priorityNumber)) { toast.error("Please select a valid priority"); return; }
    const response = await addRecipientRole(`${baseURL}/workflow/addRecipientRole`, { role: trimmed, rolePriority: priorityNumber });
    if (response && response.status === "success") { refreshDesignations(); setNewDesignation(""); setNewPriority(""); setShowInput(false); }
  };

  const handleRemoveDesignation = () => { setShowInput(false); setNewDesignation(""); setNewPriority(""); };

  // CSV import helpers
  // Use simplified template (name,email) only for CustomRecipients mode; else include legacy columns
  const csvTemplateCustomOnly = 'name,email\nJohn Doe,john@example.com';
  const csvTemplateLegacy = 'name,email,deliveryType,role\nJohn Doe,john@example.com,0,Signer';
  const activeCsvTemplate = (isUseTemplateMode && recipientConfiguration === 'CustomRecipients') ? csvTemplateCustomOnly : csvTemplateLegacy;

  const downloadTemplate = () => {
    const blob = new Blob([activeCsvTemplate], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'recipients-template.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const parseCsv = (text: string) => {
    // Basic CSV parsing handling quoted values
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
    if (!lines.length) return { header: [], rows: [] as string[][] };
    const parseLine = (line: string) => {
      const result: string[] = [];
      let cur = ''; let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i+1] === '"') { cur += '"'; i++; } else { inQuotes = !inQuotes; }
        } else if (ch === ',' && !inQuotes) { result.push(cur.trim()); cur=''; }
        else { cur += ch; }
      }
      result.push(cur.trim());
      return result;
    };
    const header = parseLine(lines[0]).map(h => h.toLowerCase());
    const rows = lines.slice(1).map(parseLine).filter(r => r.some(v=> v && v.trim() !== ''));
    return { header, rows };
  };

  const handleCsvFile = (file: File) => {
    file.text().then(text => {
      const { header, rows } = parseCsv(text);
      if (isUseTemplateMode && recipientConfiguration === 'CustomRecipients') {
        // Custom mode: only name,email, map other details from template
        const required = ['name','email'];
        const missing = required.filter(r => !header.includes(r));
        if (missing.length) { toast.error(`CSV missing columns: ${missing.join(', ')}`); return; }
        const idx = (col: string) => header.indexOf(col);
        const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const templateRecipients = originalTemplateRecipientsRef.current || [];
        const maxAllowed = templateMeta?.totalRecipients || templateRecipients.length || 0;
        const newRecipients: Recipient[] = [];
        let skipped = 0;
        rows.forEach((r,rowIdx) => {
          if (maxAllowed && newRecipients.length >= maxAllowed) return;
          const name = r[idx('name')] || '';
          const email = r[idx('email')] || '';
          if (!emailRe.test(email)) { skipped++; return; }
          const templateRec = templateRecipients[rowIdx];
          const deliveryType = templateRec ? templateRec.deliveryType : 0;
          const role = templateRec ? templateRec.role : { roleId: 0, role: '', rolePriority: 0 };
          newRecipients.push({ email, name, deliveryType, role, fields: [], templateSourceIndex: templateRec?.templateSourceIndex, templateRecipientId: templateRec?.templateRecipientId ?? null, useDefaultUser: false });
        });
        if (!newRecipients.length) { toast.error('No valid recipients found in CSV'); return; }
        setRecipients(newRecipients);
        const capped = maxAllowed && rows.length > maxAllowed;
        toast.success(`Imported ${newRecipients.length} recipient(s)${skipped? ` (${skipped} skipped)`:''}${capped? ` (capped at ${maxAllowed})`:''}`);
        return;
      }
      // Legacy / other modes: expect extended columns but tolerate missing optional ones
      const required = ['name','email'];
      const missing = required.filter(r => !header.includes(r));
      if (missing.length) { toast.error(`CSV missing columns: ${missing.join(', ')}`); return; }
      const idx = (col: string) => header.indexOf(col);
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const newRecipients: Recipient[] = [];
      let skipped = 0;
      rows.forEach(r => {
        const name = r[idx('name')] || '';
        const email = r[idx('email')] || '';
        if (!emailRe.test(email)) { skipped++; return; }
        const deliveryTypeStr = idx('deliverytype') >=0 ? r[idx('deliverytype')] : '0';
        const deliveryType = deliveryTypeStr === '1' ? 1 : 0;
        const roleName = idx('role') >=0 ? r[idx('role')] : '';
        let role = { roleId: 0, role: '', rolePriority: 0 };
        if (roleName) {
          const found = designations.find(d => d.name.toLowerCase() === roleName.toLowerCase());
          if (found) role = { roleId: found.roleId, role: found.name, rolePriority: found.priority };
        }
  newRecipients.push({ email, name, deliveryType, role, fields: [], templateRecipientId: null, useDefaultUser: false });
      });
      if (!newRecipients.length) { toast.error('No valid recipients found in CSV'); return; }
      setRecipients(prev => [...prev, ...newRecipients]);
      toast.success(`Imported ${newRecipients.length} recipient(s)${skipped? ` (${skipped} skipped)`:''}`);
    }).catch(err => {
      console.error('Failed to read CSV', err);
      toast.error('Failed to read CSV file');
    });
  };

  const triggerCsvSelect = () => { csvInputRef.current?.click(); };

  // (Removed previous localStorage-only loader; replaced by consolidated effect above)

  // Auto-fill first recipient when Add Me is checked
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'addMe') {
        if (value.addMe) {
          // Add current user recipient if not present
          if (userDetails) {
            setRecipients(prev => {
              const exists = prev.some(r => r.isMe || (userDetails.email && r.email === userDetails.email));
              if (exists) {
                // Fill missing name/email if blank on existing me-recipient
                return prev.map(r => {
                  if ((r.isMe || (userDetails.email && r.email === userDetails.email)) && (!r.email || !r.name)) {
                    const email = r.email || userDetails.email || '';
                    const name = r.name || [userDetails.fname, userDetails.lname].filter(Boolean).join(' ').trim();
                    return { ...r, email, name };
                  }
                  return r;
                });
              }
              const email = userDetails.email || '';
              const name = [userDetails.fname, userDetails.lname].filter(Boolean).join(' ').trim();
              // Prepend "me" to maintain first position for signing order when sendInOrder is true
              return [{ email, name, deliveryType: 0, role: { roleId: 0, role: '', rolePriority: 0 }, fields: [], isMe: true }, ...prev];
            });
          }
        } else {
          // Remove auto-added me recipient when unchecked
          setRecipients(prev => prev.filter(r => !r.isMe));
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form, userDetails]);

  // If userDetails arrive after Add Me already checked, ensure hydration
  useEffect(() => {
    // If user details fetched after Add Me checked and not present yet, add it
    if (form.getValues('addMe') && userDetails) {
      setRecipients(prev => {
        const exists = prev.some(r => r.isMe || (userDetails.email && r.email === userDetails.email));
        if (exists) return prev;
        const email = userDetails.email || '';
        const name = [userDetails.fname, userDetails.lname].filter(Boolean).join(' ').trim();
        return [{ email, name, deliveryType: 0, role: { roleId: 0, role: '', rolePriority: 0 }, fields: [], isMe: true }, ...prev];
      });
    }
  }, [userDetails, form]);

  // Derived metrics for dashboard UX (defensive against undefined entries)
  const safeRecipients = Array.isArray(recipients) ? recipients.filter(r => !!r && typeof r === 'object') : [];
  // Base completeness: name + email present (designation may still be pending)
  const baseCompleteRecipients = safeRecipients.filter(r => (r as any).email && (r as any).name).length;
  const allBaseRecipientsComplete = baseCompleteRecipients === safeRecipients.length && safeRecipients.length > 0;
  // Full completeness (including role) for submit gating
  const fullyCompleteRecipients = safeRecipients.filter(r => (r as any).email && (r as any).name && (r as any).role && (r as any).role.roleId > 0).length;
  const incompleteRecipients = safeRecipients.length - fullyCompleteRecipients;
  const effectiveFile = acceptedFiles[0] || preloadedFile || null;
  const hasFile = !!effectiveFile;
  const autoReminderEnabled = form.watch("autoReminder");
  const rawDocumentName = form.watch("documentName");
  const documentName = (rawDocumentName && rawDocumentName.trim().length) ? rawDocumentName : 'Untitled';
  const steps = [
    // Document step now only done when file is chosen AND a non-empty document name entered (not fallback 'Untitled').
    { key: 'document', label: 'Document', done: hasFile && !!rawDocumentName && rawDocumentName.trim().length > 0 },
  { key: 'recipients', label: 'Recipients', done: allBaseRecipientsComplete },
    { key: 'settings', label: 'Settings', done: showSettings && (form.watch('agreementValidUntil') || form.watch('documentType') || form.watch('description')) },
    { key: 'note', label: 'Note', done: !!form.watch('noteToRecipients') },
    { key: 'prepare', label: 'Prepare', done: false }
  ];
  const progressPct = Math.round((steps.filter(s=>s.done).length / steps.length) * 100);

  // Preload template recipients when in use-template mode and configuration requires them
  useEffect(() => {
    if (!isUseTemplateMode || !templateId) return;
    const needsTemplateRecipients = ['FromTemplate','Mixed','CreateNewTemplate'].includes(recipientConfiguration);
    if (!needsTemplateRecipients) return; // skip if custom only
    if (templateRecipientsLoaded && templateMeta) {
      // Already loaded once; if we toggled away and came back to FromTemplate ensure we repopulate from cache
      if (recipientConfiguration === 'FromTemplate' && originalTemplateRecipientsRef.current && recipients.length === 0) {
        setRecipients(originalTemplateRecipientsRef.current);
      }
      return; // no new fetch
    }
    if (fetchInFlightRef.current) return; // prevent duplicate concurrent fetch
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers: Record<string,string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    (async () => {
      try {
        fetchInFlightRef.current = true;
        const base = process.env.NEXT_PUBLIC_LOCAL_API_URL || 'http://localhost:3000';
        const res = await fetch(`${base}/template/getTemplateDetails?templateId=${templateId}`, { headers });
        if (!res.ok) throw new Error('Failed to fetch template details');
        const json = await res.json();
        const data = json?.data || json;
        // Extract backend common fields (new CommonFields array on each document)
        const docs = data?.documents?.$values || data?.documents || data?.Documents?.$values || data?.Documents || [];
        const aggregatedCommon: any[] = [];
        if (Array.isArray(docs)) {
          docs.forEach((d: any) => {
            const cfSrc = d?.commonFields || d?.CommonFields;
            const list = (cfSrc?.$values || cfSrc) || [];
            if (Array.isArray(list) && list.length) aggregatedCommon.push(...list);
          });
        }
        // Deduplicate common by FieldId
        const commonById = new Map<number, any>();
        aggregatedCommon.forEach(cf => {
          const fid = cf.fieldId || cf.FieldId;
            if (fid != null && !commonById.has(fid)) commonById.set(fid, cf);
        });
        const commonFieldsArray = Array.from(commonById.values()).map(cf => ({
          fieldId: cf.fieldId || cf.FieldId || null,
          fieldType: cf.fieldType || cf.FieldType || 'text',
          fieldName: cf.fieldName || cf.FieldName || 'Field',
          position: cf.fieldPosition || cf.FieldPosition || cf.position || cf.Position || '',
          isRequired: !!(cf.isRequired ?? cf.IsRequired)
        }));
        // Stash into ref for context building fallback if override not provided
        (window as any).__TEMPLATE_COMMON_FIELDS_FALLBACK__ = commonFieldsArray;
        console.log('[SendForSignature] Fallback common fields fetched', { count: commonFieldsArray.length, sample: commonFieldsArray.slice(0,3) });
        // Some backends nest recipients under documents[0].recipients; prefer top-level if present else fallback
        const topLevelRecipients: any[] = data?.recipients?.$values || data?.recipients || data?.Recipients?.$values || data?.Recipients || [];
        let docRecipients: any[] = [];
  // docs already declared above
        if (Array.isArray(docs) && docs.length) {
          const firstDoc = docs[0];
            docRecipients = firstDoc?.recipients?.$values || firstDoc?.recipients || firstDoc?.Recipients?.$values || firstDoc?.Recipients || [];
        }
    const rawRecipients: any[] = (topLevelRecipients.length ? topLevelRecipients : docRecipients) || [];
    const mapped: Recipient[] = rawRecipients.map((r, idx) => {
          // Fallback chain includes defaultUserName/defaultUserEmail & recipientRoleName seen in sample payload
          const email = r.email || r.Email || r.defaultUserEmail || r.DefaultUserEmail || '';
          const name = r.name || r.Name || r.defaultUserName || r.DefaultUserName || '';
          // Map deliveryType: backend might send numeric or textual (NeedsToSign / ReceivesCopy)
          let deliveryTypeVal = r.deliveryType ?? r.DeliveryType;
          if (deliveryTypeVal === undefined && (r.deliveryTypeName || r.DeliveryTypeName)) {
            deliveryTypeVal = (r.deliveryTypeName || r.DeliveryTypeName) === 'ReceivesCopy' ? 1 : 0;
          }
          if (typeof deliveryTypeVal === 'string') {
            const lower = deliveryTypeVal.toLowerCase();
            if (lower.includes('copy')) deliveryTypeVal = 1; else deliveryTypeVal = 0;
          }
          const roleId = r.role?.roleId || r.roleId || r.recipientRoleId || r.RecipientRoleId || r.RoleId || 0;
          const roleName = r.role?.role || r.role || r.Role || r.recipientRoleName || r.RecipientRoleName || '';
            const rolePriority = r.role?.rolePriority || r.rolePriority || r.RolePriority || 0;
          const templateRecipientId = r.templateRecipientId || r.TemplateRecipientId || r.recipientId || r.RecipientId || r.id || r.Id || null;
          return {
            email,
            name,
            deliveryType: Number.isInteger(deliveryTypeVal) ? deliveryTypeVal : 0,
            role: {
              roleId,
              role: roleName,
              rolePriority,
            },
            fields: (r.fields?.$values || r.fields || r.Fields?.$values || r.Fields || []).map((f: any) => {
              const positionRaw = f.position || f.Position || f.fieldPosition || f.FieldPosition || '';
              let x: number | null = null; let y: number | null = null; let page: number | null = null;
              if (positionRaw && typeof positionRaw === 'string' && positionRaw.includes(',')) {
                const parts = positionRaw.split(',').map((p: string) => p.trim());
                const px = parseFloat(parts[0]);
                const py = parts.length > 1 ? parseFloat(parts[1]) : NaN;
                if (!Number.isNaN(px)) x = px;
                if (!Number.isNaN(py)) y = py;
                if (parts.length >= 3) {
                  const pPage = parseInt(parts[2]); if (!Number.isNaN(pPage)) page = pPage;
                }
              }
              const width = f.width || f.Width || null;
              const height = f.height || f.Height || null;
              return {
                fieldId: f.fieldId || f.FieldId || 0,
                fieldType: f.fieldType || f.FieldType || 'text',
                fieldName: f.fieldName || f.FieldName || 'Field',
                position: positionRaw,
                isRequired: !!(f.isRequired ?? f.IsRequired),
                x,
                y,
                page,
                width,
                height,
              };
            }),
            templateSourceIndex: idx,
            templateRecipientId,
            useDefaultUser: true,
          } as Recipient;
        });
  // Progressive insertion for better perceived loading; store original full set for later toggles
  originalTemplateRecipientsRef.current = mapped;
  setRecipients(prev => recipientConfiguration === 'Mixed' ? [...prev] : []);
        let i = 0;
        const baseRecipients = recipientConfiguration === 'Mixed' ? [...recipients] : [];
        const insertNext = () => {
          setRecipients(current => [...current, mapped[i]]);
          i++;
          if (i < mapped.length) {
            setTimeout(insertNext, 60); // 60ms interval for smooth buildup
          }
        };
        if (mapped.length) insertNext();
        setTemplateRecipientsLoaded(true);
        setTemplateMeta({
          name: data?.templateName || data?.name || data?.Name,
          description: data?.description || data?.Description,
          ownerName: data?.owner?.name || data?.Owner?.name || data?.Owner?.Name || data?.owner?.Name,
          ownerEmail: data?.owner?.email || data?.Owner?.email || data?.Owner?.Email || data?.owner?.Email,
          totalRecipients: data?.totalRecipients ?? data?.TotalRecipients ?? rawRecipients.length,
          totalFields: data?.totalFields ?? data?.TotalFields ?? 0,
          totalFiles: data?.totalFiles ?? data?.TotalFiles ?? data?.documents?.$values?.length ?? data?.documents?.length ?? 0,
          usageCount: data?.usageCount ?? data?.UsageCount ?? 0,
          isSequentialSigningEnabled: !!(data?.isSequentialSigningEnabled ?? data?.IsSequentialSigningEnabled),
        });
  // Prefer first document title, then explicit template-level names
  const firstDoc = (docs && Array.isArray(docs) && docs.length) ? docs[0] : null;
  const docTitle = firstDoc?.title || firstDoc?.Title;
  const docName = docTitle || data?.templateName || data?.name || data?.Name || 'Template Document';
  if (!form.getValues('documentName')) form.setValue('documentName', docName);
        if (data?.description || data?.Description) form.setValue('description', data?.description || data?.Description);
        if (typeof data?.isSequentialSigningEnabled === 'boolean' || typeof data?.IsSequentialSigningEnabled === 'boolean') {
          form.setValue('sendInOrder', !!(data?.isSequentialSigningEnabled ?? data?.IsSequentialSigningEnabled));
        }
        if (data?.reminderIntervalDays || data?.ReminderIntervalDays) {
          form.setValue('reminderDays', String(data?.reminderIntervalDays || data?.ReminderIntervalDays));
        }
        if (data?.recipientMessage || data?.RecipientMessage) {
          form.setValue('noteToRecipients', data?.recipientMessage || data?.RecipientMessage);
        }
        // Attempt to locate a direct document URL / binary reference first
        const possibleDocUrl = data?.documentUrl || data?.DocumentUrl || data?.fileUrl || data?.FileUrl || data?.pdfUrl || data?.PdfUrl;
        if (possibleDocUrl && !preloadedFile) {
          try {
            const fileRes = await fetch(possibleDocUrl);
            if (fileRes.ok) {
              const blob = await fileRes.blob();
              if (blob.type === 'application/pdf' || possibleDocUrl.toLowerCase().endsWith('.pdf')) {
                const file = new File([blob], docName.endsWith('.pdf') ? docName : docName + '.pdf', { type: 'application/pdf' });
                setPreloadedFile(file);
              }
            }
          } catch (e) {
            console.warn('Failed to preload template PDF via direct URL', e);
          }
        }
        // If no direct URL or it failed, try fetching via fileresource API using first document's first fileResourceId
        if (!preloadedFile && !fileResourceFetchedRef.current) {
          try {
            const firstDocObj = Array.isArray(docs) && docs.length ? docs[0] : null;
            const filesSource = firstDocObj ? (firstDocObj.templateDocumentFiles || firstDocObj.files || firstDocObj.TemplateDocumentFiles || firstDocObj.Files || []) : [];
            const filesArray: any[] = filesSource?.$values || filesSource || [];
            const firstFile = Array.isArray(filesArray) && filesArray.length ? filesArray[0] : null;
            const fileResourceId = firstFile?.fileResourceId || firstFile?.FileResourceId || firstFile?.fileId || firstFile?.FileId;
            if (fileResourceId) {
              const apiBase = process.env.NEXT_PUBLIC_LOCAL_API_URL?.replace(/\/$/,'') || 'http://localhost:5035/api';
              const authToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
              if (authToken) {
                const fileResp = await fetch(`${apiBase}/fileresource/${fileResourceId}`, { headers: { Authorization: `Bearer ${authToken}` } });
                if (fileResp.ok) {
                  const blob = await fileResp.blob();
                  // Only accept pdf; backend should return correct content-type
                  const ct = fileResp.headers.get('content-type') || '';
                  const looksPdf = ct.includes('pdf') || (firstFile?.fileName || '').toLowerCase().endsWith('.pdf') || docName.toLowerCase().includes('.pdf');
                  if (looksPdf) {
                    const finalNameBase = (firstFile?.fileName || docName || 'TemplateDocument').replace(/\.pdf$/i,'');
                    const finalFile = new File([blob], finalNameBase + '.pdf', { type: 'application/pdf' });
                    setPreloadedFile(finalFile);
                    fileResourceFetchedRef.current = true;
                  }
                } else {
                  console.warn('File resource fetch failed', fileResp.status, fileResp.statusText);
                }
              }
            }
          } catch (e) {
            console.warn('Failed to preload template PDF via fileResourceId', e);
          } finally {
            fileResourceFetchedRef.current = true; // Prevent repeated attempts even on failure
          }
        }
      } catch (e) {
        console.error('Template preload failed', e);
        toast.error('Failed to load template recipients');
      } finally {
        fetchInFlightRef.current = false;
      }
    })();
  }, [isUseTemplateMode, templateId, recipientConfiguration, templateRecipientsLoaded, form, templateMeta, recipients]);

  // Clear recipients if switching to CustomRecipients after load
  useEffect(() => {
    if (!isUseTemplateMode) return;
    if (recipientConfiguration === 'CustomRecipients') {
      setRecipients([]);
    }
  }, [recipientConfiguration, isUseTemplateMode]);

  // When switching BACK to FromTemplate after initial load, restore cached template recipients (not adding duplicates)
  useEffect(() => {
    if (!isUseTemplateMode) return;
    if (recipientConfiguration !== 'FromTemplate') return;
    if (!originalTemplateRecipientsRef.current) return;
    // If current recipients already match cache length and every email matches, do nothing
    const cached = originalTemplateRecipientsRef.current;
    // Normalize arrays by filtering only valid recipient-like objects
    const normalize = (arr: any[]): any[] => Array.isArray(arr) ? arr.filter(r => r && typeof r === 'object') : [];
    const normCurrent = normalize(recipients);
    const normCached = normalize(cached);
    if (normCurrent.length === normCached.length) {
      const allMatch = normCurrent.every((r,i) => {
        const c = normCached[i];
        const rEmail = typeof r?.email === 'string' ? r.email : '';
        const cEmail = typeof c?.email === 'string' ? c.email : '';
        const rName = typeof r?.name === 'string' ? r.name : '';
        const cName = typeof c?.name === 'string' ? c.name : '';
        return rEmail === cEmail && rName === cName;
      });
      if (allMatch) return; // already same
    }
    setRecipients(normCached);
  }, [recipientConfiguration, isUseTemplateMode, recipients]);

  // When switching from CustomRecipients to Mixed after template data already loaded, append missing template recipients
  // This preserves any custom recipients already entered while ensuring template defaults are present.
  useEffect(() => {
    if (!isUseTemplateMode) return;
    if (recipientConfiguration !== 'Mixed') return;
    if (!templateRecipientsLoaded) return; // template not fetched yet
    const cached = originalTemplateRecipientsRef.current;
    if (!cached || !cached.length) return;
    // Match presence by stable templateSourceIndex instead of mutable identity fields to avoid duplicates when identity cleared
    const missing = cached.filter(c => !recipients.some(r => r.templateSourceIndex === c.templateSourceIndex));
    if (missing.length === 0) return; // nothing to add
    setRecipients(prev => [...prev, ...missing]);
  }, [recipientConfiguration, isUseTemplateMode, templateRecipientsLoaded, recipients]);

  return (
    <div className="w-full max-w-7xl mx-auto p-6 space-y-8">
      {/* Header + Progress */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-3">
              {modeOverride === 'use-template' ? 'Use Template' : (mode === 'template' ? 'Create Template' : (isWorkflowCreation ? 'Workflow' : 'Send for Signature'))}
            </h1>
            <p className="text-sm text-muted-foreground max-w-prose">{modeOverride === 'use-template' ? 'Start a workflow from this template. Choose how to use existing recipients or customize.' : (mode === 'template' ? 'Upload a PDF, define recipients & create a reusable template.' : (isWorkflowCreation ? 'Upload a PDF, define recipients & configure metadata prior to creating workflow.' : 'Upload a PDF, define recipients & configure metadata prior to preparing mapping.'))}</p>
          </div>
          <div className="w-full md:w-80 flex flex-col gap-1">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
              <span>Setup Progress</span><span>{progressPct}%</span>
            </div>
            <div className="h-2 rounded bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: progressPct + '%' }} />
            </div>
          </div>
        </div>
        <nav aria-label="Signature setup steps" className="grid gap-2 sm:grid-cols-5">
          {steps.map((s,i) => (
            <div key={s.key} className={`group flex items-center gap-2 rounded-md border px-2 py-2 text-xs font-medium ${s.done? 'bg-primary text-primary-foreground border-primary shadow-sm':'bg-card hover:bg-muted/60 border-border'} transition`}>              <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-semibold border ${s.done? 'bg-primary-foreground/20 border-primary-foreground/40':'bg-muted border-border text-muted-foreground'}`}>{i+1}</div>
              <span className="truncate">{s.label}</span>
              {s.done && <Check className="h-3 w-3" />}
            </div>
          ))}
        </nav>
      </div>

      <div className="grid gap-8 lg:grid-cols-3 xl:grid-cols-4">
        {/* Main form area */}
        <div className="space-y-8 lg:col-span-2 xl:col-span-3">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-5 p-6 border border-border rounded-xl bg-gradient-to-br from-card to-muted/40 shadow-sm hover:shadow-md transition-shadow">
            {isUseTemplateMode && (
              <div className="flex flex-col gap-4 p-4 rounded-md border border-border/60 bg-muted/30">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm font-semibold tracking-tight">Template Context</h3>
                  {templateMeta?.name && (
                    <span className="text-[10px] px-2 py-1 rounded-full bg-muted text-muted-foreground border" title={templateMeta.name}>{templateMeta.name}</span>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-[10px]">
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">Owner</span>
                    <span className="font-medium truncate" title={templateMeta?.ownerName}>{templateMeta?.ownerName || '—'}</span>
                    {templateMeta?.ownerEmail && <span className="text-muted-foreground/70 truncate">{templateMeta.ownerEmail}</span>}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">Recipients</span>
                    <span className="font-medium">{templateMeta?.totalRecipients ?? '—'}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">Fields</span>
                    <span className="font-medium">{templateMeta?.totalFields ?? '—'}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">Files</span>
                    <span className="font-medium">{templateMeta?.totalFiles ?? '—'}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">Usage</span>
                    <span className="font-medium">{templateMeta?.usageCount ?? 0}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-muted-foreground">Signing Mode</span>
                    <span className="font-medium">{templateMeta?.isSequentialSigningEnabled ? 'Sequential' : 'Parallel'}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-medium text-muted-foreground">Recipient Configuration</label>
                  <select
                    className="w-full text-xs rounded-md border border-border bg-background px-2 py-2 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={recipientConfiguration}
                    onChange={(e) => setRecipientConfiguration(e.target.value as any)}
                  >
                    {recipientConfigOptions.map(opt => (
                      <option key={opt.key} value={opt.key}>{opt.label}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground min-h-[30px]">
                    {recipientConfigOptions.find(o => o.key === recipientConfiguration)?.description}
                  </p>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />Document</h2>
              <span className="text-[10px] rounded-full px-2 py-1 bg-muted text-muted-foreground border">Step 1</span>
            </div>
            {/* Single file upload: hide dropzone once a file is chosen; show replace button */}
            {!isUseTemplateMode && !isFromTemplateLocked && !hasFile && (
              <div {...getRootProps()} className="group border-2 border-dashed border-primary/30 rounded-lg p-8 text-center hover:border-primary/60 hover:bg-primary/5 transition-all cursor-pointer bg-muted/30 relative">
                <input {...getInputProps()} />
                <Upload className="h-12 w-12 mx-auto mb-4 text-primary group-hover:scale-105 transition-transform" />
                <p className="text-sm text-muted-foreground">Drag & drop a PDF here, or click to select</p>
              </div>
            )}
            {!isUseTemplateMode && !isFromTemplateLocked && hasFile && (
              <div className="flex items-center justify-between gap-3 p-4 bg-secondary rounded-lg border border-border">
                <div className="flex items-center gap-3 flex-1">
                  <Image src={pdf} alt="pdf" width={24} height={24} />
                  <span className="text-sm font-medium flex-1 text-foreground truncate" title={effectiveFile?.name}>{effectiveFile?.name}</span>
                  <span className="text-xs text-muted-foreground">{effectiveFile ? (effectiveFile.size / 1024).toFixed(2) : '0'} KB</span>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => openFileDialog()} className="shrink-0">Replace File</Button>
              </div>
            )}
            {isFromTemplateLocked && (
              <div className="border rounded-lg p-4 bg-muted/30 flex flex-col gap-1 text-xs">
                <div className="flex items-center justify-between"><span className="font-medium text-foreground">Template Document</span><span className="text-[10px] px-2 py-1 rounded bg-muted text-muted-foreground border">Read Only</span></div>
                {hasFile ? <span className="text-muted-foreground">{effectiveFile?.name}</span> : <span className="text-muted-foreground">Document from template</span>}
              </div>
            )}
            {(effectiveFile && (isFromTemplateLocked || isUseTemplateMode)) && (
              <div className="flex items-center gap-3 p-4 bg-secondary rounded-lg border border-border">
                <Image src={pdf} alt="pdf" width={24} height={24} />
                <span className="text-sm font-medium flex-1 text-foreground" title={effectiveFile.name}>{effectiveFile.name}</span>
                <span className="text-xs text-muted-foreground">{(effectiveFile.size / 1024).toFixed(2)} KB</span>
                {preloadedFile && !acceptedFiles[0] && (
                  <span className="text-[10px] px-2 py-1 rounded bg-muted text-muted-foreground border">Preloaded</span>
                )}
              </div>
            )}
            <FormField control={form.control} name="documentName" render={({ field }) => (
              <FormItem>
                <FormLabel>Document Name</FormLabel>
                <FormControl><Input placeholder="Enter document name" {...field} title={field.value} readOnly={isFromTemplateLocked || isUseTemplateMode} className={(isFromTemplateLocked || isUseTemplateMode)? 'opacity-70 cursor-not-allowed':''} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </div>
          <div className="space-y-5 p-6 border border-border rounded-xl bg-gradient-to-br from-card to-muted/40 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">Recipients</h2>
              <span className="text-[10px] rounded-full px-2 py-1 bg-muted text-muted-foreground border">Step 2</span>
            </div>
            {/* Hide template-specific ordering/self-add controls in use-template workflow creation */}
            {!isUseTemplateMode && (
              <div className="space-y-3">
                <FormField control={form.control} name="sendInOrder" render={({ field }) => (
                  <FormItem className={`flex flex-row items-start space-x-3 space-y-0 rounded-md ${!isFromTemplateLocked && 'hover:bg-secondary/20'}`}>
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isFromTemplateLocked} className="h-5 w-5 border-2 border-primary/50 data-[state=checked]:border-primary data-[state=checked]:bg-primary disabled:opacity-60" /></FormControl>
                    <div className="space-y-1 leading-none"><FormLabel className="text-sm font-medium">Send in order</FormLabel></div>
                  </FormItem>
                )} />
                <FormField control={form.control} name="addMe" render={({ field }) => (
                  <FormItem className={`flex flex-row items-start space-x-3 space-y-0 rounded-md ${!isFromTemplateLocked && 'hover:bg-secondary/20'}`}>
                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} disabled={isFromTemplateLocked} className="h-5 w-5 border-2 border-primary/50 data-[state=checked]:border-primary data-[state=checked]:bg-primary disabled:opacity-60" /></FormControl>
                    <div className="space-y-1 leading-none"><FormLabel className="text-sm font-medium">Add me</FormLabel></div>
                  </FormItem>
                )} />
              </div>
            )}
            <div className="space-y-4 mt-6">
              {recipients.length === 0 && <div className="text-xs text-muted-foreground border border-dashed rounded-md p-4">{isFromTemplateLocked ? 'No recipients loaded from template yet.' : 'No recipients yet. Add manually or import from CSV.'}</div>}
              {(recipients || []).map((rawRecipient, index) => {
                // Normalize recipient to avoid undefined access during template preload race conditions
                const recipient = rawRecipient && typeof rawRecipient === 'object' ? rawRecipient : {
                  email: '',
                  name: '',
                  deliveryType: 0,
                  role: { roleId: 0, role: '', rolePriority: 0 },
                  fields: [],
                  useDefaultUser: false,
                  templateRecipientId: null
                } as any;
                const isMixedMode = isUseTemplateMode && recipientConfiguration === 'Mixed';
                const isCustomMode = isUseTemplateMode && recipientConfiguration === 'CustomRecipients';
                const originalTemplateRecipients = originalTemplateRecipientsRef.current || [];
                const isTemplateRecipient = index < originalTemplateRecipients.length;
                // Track whether recipient is currently using template defaults (for Mixed/Custom). We'll derive by comparing name/email to cached template.
                const defaultSource = isTemplateRecipient ? originalTemplateRecipients[index] : null;
                const isUsingDefaultIdentity = !!(defaultSource && recipient?.name === defaultSource.name && recipient?.email === defaultSource.email);
                const lockAll = isFromTemplateLocked && !(isMixedMode || isCustomMode);
                // lockNonIdentity should apply to template recipients in Mixed mode AND all recipients in Custom mode (deliveryType & role are template properties)
                const lockNonIdentity = lockAll || (isMixedMode && isTemplateRecipient) || isCustomMode;
                // Updated behavior: In Mixed mode name/email always editable; in Custom mode also editable. Only FromTemplate locked.
                const nameEmailReadOnly = lockAll; // remove conditional lock for Mixed template identity
                return (
                  <div key={index} className={`grid grid-cols-12 items-start gap-3 p-4 rounded-lg border transition-all ${recipient.email && recipient.name && recipient.role.role ? 'bg-secondary/60 border-primary/50 shadow-sm' : 'bg-secondary/30 border-border/70 hover:border-primary/40'} ${lockAll ? 'opacity-80' : ''}`}>
                    <div className="col-span-12 sm:col-span-1 flex items-center justify-center"><span className="text-xs font-semibold inline-flex items-center justify-center h-7 w-7 rounded-full bg-muted text-muted-foreground border border-border">{index + 1}</span></div>
                    <div className="col-span-12 sm:col-span-11 grid grid-cols-1 sm:grid-cols-5 gap-2">
                      <Input type="text" placeholder="Name" value={recipient.name} onChange={(e) => handleRecipientChange(index, 'name', e.target.value)} readOnly={nameEmailReadOnly} className={nameEmailReadOnly ? 'opacity-70 cursor-not-allowed' : ''} />
                      <Input type="email" placeholder="Email" value={recipient.email} onChange={(e) => handleRecipientChange(index, 'email', e.target.value)} readOnly={nameEmailReadOnly} className={nameEmailReadOnly ? 'opacity-70 cursor-not-allowed' : ''} />
                      <Select value={recipient.deliveryType.toString()} onValueChange={(value) => handleRecipientChange(index, 'deliveryType', parseInt(value))} disabled={lockNonIdentity}>
                        <SelectTrigger><SelectValue placeholder="Select delivery type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Needs to Sign</SelectItem>
                          <SelectItem value="1">Receives a Copy</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2 relative">
                        <Select value={recipient.role.role || ''} onValueChange={(value) => { if (value === '__add__') setShowInput(true); else handleRecipientChange(index, 'role', value); }} disabled={lockNonIdentity}>
                          <SelectTrigger className="flex-1"><SelectValue placeholder="Designation" /></SelectTrigger>
                          <SelectContent>
                            {loadingDesignations && <div className="px-2 py-1 text-xs text-muted-foreground">Loading roles...</div>}
                            {error && <div className="px-2 py-1 text-xs text-destructive">{(error as Error).message || 'Failed to load roles'}</div>}
                            {!loadingDesignations && !error && designations.length === 0 && <div className="px-2 py-1 text-xs text-muted-foreground">No roles found. Add one below.</div>}
                            {designations.map((d, i) => (<SelectItem key={i} value={d.name}>{`${d.name} (${d.priority})`}</SelectItem>))}
                            <SelectItem value="__add__">+ Add New Designation</SelectItem>
                          </SelectContent>
                        </Select>
                        {/* Identity badge (hidden for Mixed mode template recipients to avoid duplicate labels with toggle button) */}
                        {isUseTemplateMode && !(isMixedMode && isTemplateRecipient) && (
                          <div className="flex items-center">
                            <span
                              className={`text-[10px] px-2 py-1 rounded-full border ml-1 whitespace-nowrap ${recipient.useDefaultUser ? 'bg-primary/10 border-primary/40 text-primary' : (recipient.templateRecipientId ? 'bg-amber-500/10 border-amber-500/40 text-amber-700' : 'bg-muted border-border text-muted-foreground')}`}
                              title={recipient.useDefaultUser ? 'Template identity in use' : (recipient.templateRecipientId ? 'Template-linked custom identity' : 'Pure custom recipient')}
                            >
                              {recipient.useDefaultUser ? 'Template User' : (recipient.templateRecipientId ? 'Custom (Linked)' : 'Custom')}
                            </span>
                          </div>
                        )}
                        {!lockAll && !isUseTemplateMode && <Button type="button" aria-label="Remove recipient" onClick={() => handleRemoveRecipient(index)} className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border bg-transparent text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                      {isMixedMode && isTemplateRecipient && originalTemplateRecipients.length > 0 && (
                        <div className="flex items-center">
                          <Button
                            type="button"
                            variant={isUsingDefaultIdentity ? 'outline' : 'secondary'}
                            size="sm"
                            className="h-8 px-2 text-[9px] flex items-center gap-1"
                            onClick={() => {
                              const templ = originalTemplateRecipients[index];
                              if (!templ) return;
                              setRecipients(prev => prev.map((r,i) => {
                                if (i !== index) return r;
                                if (r.name === templ.name && r.email === templ.email) {
                                  return { ...r, name: '', email: '', useDefaultUser: false };
                                } else {
                                  return { ...r, name: templ.name, email: templ.email, useDefaultUser: true };
                                }
                              }));
                            }}
                          >
                            {isUsingDefaultIdentity ? (
                              <>
                                <UserCheck className="h-3.5 w-3.5" />
                                Template User
                              </>
                            ) : (
                              <>
                                <UserCog className="h-3.5 w-3.5" />
                                Custom User
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                      {/* Fields button removed: field placement now deferred to Prepare Document */}
                    </div>
                      {/* Removed inline recipient fields panel */}
                  </div>
                );
              })}
            </div>
            {showInput && !isFromTemplateLocked && (
              <div className="flex gap-3 items-end p-4 bg-primary/5 border border-primary/30 rounded-lg">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block text-foreground">Designation Name</label>
                  <Input type="text" placeholder="Enter custom designation" value={newDesignation} onChange={(e) => setNewDesignation(e.target.value)} />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block text-foreground">Priority</label>
                  <Select value={newPriority} onValueChange={setNewPriority}>
                    <SelectTrigger><SelectValue placeholder="Select Priority" /></SelectTrigger>
                    <SelectContent>{[1,2,3,4,5].map(p => <SelectItem key={p} value={p.toString()}>Priority {p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button type="button" className="bg-primary text-primary-foreground hover:bg-primary/90" size="icon" onClick={handleAddDesignation} disabled={addingRole}>{addingRole ? <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : <Check className="h-4 w-4" />}</Button>
                <Button type="button" aria-label="Cancel adding designation" onClick={handleRemoveDesignation} disabled={addingRole} className="h-9 w-9 inline-flex items-center justify-center rounded-md bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"><Trash2 className="h-4 w-4" /></Button>
              </div>
            )}
            {/* Add Recipient button logic:
               - Hidden entirely in FromTemplate locked mode
               - For use-template CustomRecipients mode: enforce max based on template recipient count
               - Legacy (non use-template) unaffected */}
            {!isUseTemplateMode && !isFromTemplateLocked && (
              <Button type="button" variant="outline" className="w-full hover:bg-primary hover:text-primary-foreground" onClick={handleAddRecipient}><Plus className="h-4 w-4 mr-2" />Add Recipient</Button>
            )}
            {isUseTemplateMode && recipientConfiguration === 'CustomRecipients' && !isFromTemplateLocked && (
              <Button
                type="button"
                variant="outline"
                className="w-full hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                onClick={() => {
                  if (!canAddMoreCustom) { toast.error(`Limit reached: template allows ${maxTemplateRecipients} recipient${maxTemplateRecipients===1?'':'s'}.`); return; }
                  const templateRecipients = originalTemplateRecipientsRef.current || [];
                  const idx = recipients.length;
                  const templ = templateRecipients[idx];
                  const deliveryType = templ ? templ.deliveryType : 0;
                  const role = templ ? templ.role : { roleId: 0, role: '', rolePriority: 0 };
                  const templateRecipientId = templ?.templateRecipientId ?? null;
                  // Direct mapping requirement: inherit ALL template recipient properties (fields, role, deliveryType, etc.)
                  // Only replace identity (name/email) with blanks and mark useDefaultUser false.
                  if (templ) {
                    // Clone fields to avoid accidental shared mutation while preserving original IDs
                    const clonedFields = (templ.fields || []).map(f => ({
                      fieldId: f.fieldId,
                      fieldType: f.fieldType,
                      fieldName: f.fieldName,
                      position: f.position,
                      isRequired: f.isRequired,
                      x: (f as any).x,
                      y: (f as any).y,
                      page: (f as any).page,
                      width: (f as any).width,
                      height: (f as any).height,
                    }));
                    const mapped = {
                      email: '',
                      name: '',
                      deliveryType: templ.deliveryType,
                      role: templ.role,
                      fields: clonedFields,
                      isMe: false,
                      templateSourceIndex: templ.templateSourceIndex,
                      templateRecipientId,
                      useDefaultUser: false,
                    } as Recipient;
                    setRecipients(prev => [...prev, mapped]);
                    // Added custom template-linked recipient (debug log removed)
                  } else {
                    // Fallback (should rarely occur due to canAddMoreCustom guard)
                    setRecipients(prev => [...prev, { email: '', name: '', deliveryType, role, fields: [], isMe: false, templateSourceIndex: undefined, templateRecipientId, useDefaultUser: false }]);
                    // Template recipient source missing when adding custom recipient at index (warn removed)
                  }
                }}
                disabled={!canAddMoreCustom}
              >
                <Plus className="h-4 w-4 mr-2" />Add Recipient ({recipients.length}/{maxTemplateRecipients || 0})
              </Button>
            )}
            {!isUseTemplateMode && (
              <div className="flex flex-col sm:flex-row gap-2">
                {!isFromTemplateLocked && <>
                <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e)=>{ const f=e.target.files?.[0]; if(f) { handleCsvFile(f); e.target.value=''; } }} />
                <Button type="button" variant="secondary" onClick={triggerCsvSelect} className="flex-1">Import from CSV</Button>
                <Button type="button" variant="ghost" onClick={downloadTemplate} className="flex-1">Download Template</Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={recipients.length === 0}
                  onClick={() => {
                    if (recipients.length === 0) return;
                    const confirmed = window.confirm(`Remove all ${recipients.length} recipient(s)? This action cannot be undone.`);
                    if (!confirmed) return;
                    setRecipients([]);
                    form.setValue('addMe', false, { shouldDirty: true });
                    toast.success('All recipients removed');
                  }}
                  className="flex-1"
                >
                  Remove All
                </Button>
                </>}
              </div>
            )}
            {isUseTemplateMode && recipientConfiguration === 'CustomRecipients' && !isFromTemplateLocked && (
              <div className="flex flex-col sm:flex-row gap-2">
                {/* CSV import disabled under CustomRecipients cap once full */}
                <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e)=>{ const f=e.target.files?.[0]; if(f) { handleCsvFile(f); e.target.value=''; } }} />
                <Button type="button" variant="secondary" onClick={triggerCsvSelect} className="flex-1" disabled={!canAddMoreCustom}>Import CSV</Button>
                <Button type="button" variant="ghost" onClick={downloadTemplate} className="flex-1">Download Template</Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={recipients.length === 0}
                  onClick={() => {
                    if (recipients.length === 0) return;
                    const confirmed = window.confirm(`Remove all ${recipients.length} recipient(s)? This action cannot be undone.`);
                    if (!confirmed) return;
                    setRecipients([]);
                    form.setValue('addMe', false, { shouldDirty: true });
                    toast.success('All recipients removed');
                  }}
                  className="flex-1"
                >
                  Remove All
                </Button>
              </div>
            )}
          </div>
          <div className="space-y-5 p-6 border border-border rounded-xl bg-gradient-to-br from-card to-muted/40 shadow-sm hover:shadow-md transition-shadow">
            <button type="button" onClick={() => setShowSettings(!showSettings)} className="flex items-center justify-between w-full text-lg font-semibold text-foreground hover:text-primary transition-colors">
              <span>More Settings</span>{showSettings ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
            {showSettings && (
              <div className="space-y-4 pt-4">
                <FormField control={form.control} name="agreementValidUntil" render={({ field }) => (
                  <FormItem><FormLabel>Agreement valid until</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="documentType" render={({ field }) => (
                  <FormItem><FormLabel>Document type</FormLabel><FormControl><Input placeholder="e.g., Contract, NDA, Agreement" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => {
                  const lockDescription = isUseTemplateMode && ['FromTemplate','Mixed'].includes(recipientConfiguration);
                  return (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Add a description for this document"
                          {...field}
                          readOnly={lockDescription}
                          className={lockDescription ? 'opacity-60 cursor-not-allowed' : ''}
                        />
                      </FormControl>
                      {lockDescription && <p className="text-[10px] text-muted-foreground mt-1">Template description is locked in this mode.</p>}
                      <FormMessage />
                    </FormItem>
                  );
                }} />
                <FormField control={form.control} name="autoReminder" render={({ field }) => (
                  <FormItem className="space-y-3">
                    <div className="flex flex-row items-start space-x-3 space-y-0 rounded-md hover:bg-secondary/20">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} className="h-5 w-5 border-2 border-primary/50 data-[state=checked]:border-primary data-[state=checked]:bg-primary" /></FormControl>
                      <div className="space-y-1"><FormLabel className="text-sm font-medium cursor-pointer">Automatic Reminder</FormLabel></div>
                    </div>
                  </FormItem>
                )} />
                {form.watch("autoReminder") && (
                  <FormField control={form.control} name="reminderDays" render={({ field }) => (
                    <FormItem><FormLabel>Send reminder every (in days)</FormLabel><FormControl><Input type="number" placeholder="5" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                )}
              </div>
            )}
          </div>
          <div className="space-y-5 p-6 border border-border rounded-xl bg-gradient-to-br from-card to-muted/40 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">Note</h2>
              <span className="text-[10px] rounded-full px-2 py-1 bg-muted text-muted-foreground border">Optional</span>
            </div>
            <FormField control={form.control} name="noteToRecipients" render={({ field }) => (
              <FormItem><FormControl><Textarea placeholder="Enter your message here" className="min-h-24" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
          </div>
          <div className="p-6 border border-border rounded-xl bg-card/70 backdrop-blur-sm flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight">Review &amp; {mode === 'template' ? 'Create Template' : (isWorkflowCreation ? 'Create Workflow' : 'Prepare Document')}</h2>
              <div className="flex items-center gap-2">
                {onCancelEmbed && (
                  <Button type="button" variant="outline" size="sm" className="h-8 text-[10px]" onClick={onCancelEmbed}>Cancel</Button>
                )}
                <span className="text-[10px] px-2 py-1 rounded-full bg-muted text-muted-foreground border">Step 5</span>
              </div>
            </div>
            <ul className="text-xs space-y-1 text-muted-foreground">
              <li>File: {hasFile ? (effectiveFile?.name || 'Loaded file') : 'None uploaded'}</li>
              <li>Recipients: {recipients.length} total • {fullyCompleteRecipients} fully complete • {incompleteRecipients} incomplete</li>
              <li>Reminder: {autoReminderEnabled ? `Every ${form.watch('reminderDays')} day(s)` : 'Disabled'}</li>
              <li>Valid Until: {form.watch('agreementValidUntil') ? formatDateDDMMYYYY(form.watch('agreementValidUntil') + 'T00:00:00') : 'Not set'}</li>
            </ul>
            <Button type="submit" size="lg" disabled={isSubmitting} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 font-bold text-sm shadow-lg hover:shadow-xl transition-all">
              {isSubmitting ? <div className="h-5 w-5 mr-2 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : <FileText className="h-5 w-5 mr-2" />}
              {mode === 'template' ? (isSubmitting ? 'Creating Template...' : 'Create Template') : (isWorkflowCreation ? (isSubmitting ? 'Creating Workflow...' : 'Create Workflow') : 'Prepare Document')}
            </Button>
          </div>
        </form>
      </Form>
        </div>
        {/* Sidebar */}
        <aside className="hidden lg:flex flex-col gap-6 xl:col-span-1">
          <div className="p-5 rounded-xl border border-border bg-card/80 backdrop-blur-sm shadow-sm space-y-4">
            <h3 className="text-sm font-semibold tracking-tight flex items-center gap-2">Current Summary</h3>
            <div className="grid gap-3">
              <div className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Document</span>
                <span className="font-medium truncate" title={documentName}>{documentName}</span>
                <span className="text-[10px] text-muted-foreground">{hasFile ? (effectiveFile?.name || 'Loaded file') : 'No file'}</span>
              </div>
              <div className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Recipients ({recipients.length})</span>
                <span className="font-medium">{fullyCompleteRecipients} complete • {incompleteRecipients} pending</span>
                {(Array.isArray(safeRecipients) ? safeRecipients : []).slice(0,4).map((r: any,i: number)=>{
                  const name = typeof r?.name === 'string' && r.name.trim() ? r.name.trim() : 'Unnamed';
                  const email = typeof r?.email === 'string' && r.email.trim() ? r.email.trim() : '';
                  return <span key={i} className="truncate text-[10px] text-muted-foreground">{name}{email ? ` • ${email}`: ''}</span>;
                })}
                {safeRecipients.length > 4 && <span className="text-[10px] text-muted-foreground">+{safeRecipients.length - 4} more</span>}
              </div>
              <div className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Reminder</span>
                <span className="font-medium">{autoReminderEnabled? `Every ${form.watch('reminderDays')} day(s)`:'Disabled'}</span>
              </div>
              <div className="flex flex-col gap-1 text-xs">
                <span className="text-muted-foreground">Valid Until</span>
                <span className="font-medium">{form.watch('agreementValidUntil') ? formatDateDDMMYYYY(form.watch('agreementValidUntil') + 'T00:00:00') : 'Not set'}</span>
              </div>
            </div>
            <div className="mt-2">
              <div className="h-1 rounded bg-muted overflow-hidden"><div className="h-full bg-primary" style={{width: progressPct+'%'}} /></div>
              <p className="text-[10px] text-muted-foreground mt-1">Progress {progressPct}%</p>
            </div>
          </div>
          <div className="p-4 rounded-xl border border-dashed border-border text-[10px] text-muted-foreground space-y-2">
            <p className="font-medium text-xs">Tips</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Ensure each recipient has a unique email.</li>
              <li>Use Designations to define signing order.</li>
              <li>Automatic reminders help reduce turnaround time.</li>
              <li>Set a validity date to enforce deadline.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default SendForSignaturePage;
