// Template API types & mapping utilities
export enum TemplateStatusEnum {
  Draft = 0,
  Active = 1,
}

export type TemplateStatusUI = 'draft' | 'active';

export interface TemplateResponseRaw {
  templateId: number;
  templateName?: string | null;
  templateOwner?: string | null;
  workflowId: number; // last associated workflow or 0
  templateDescription?: string | null;
  createdOn: string; // ISO
  templateStatus: TemplateStatusEnum; // numeric enum from backend
  usageCount: number;
  isSequentialSigningEnabled?: boolean; // new flag from backend list DTO
}

// Paged wrapper (.NET style) – align with workflow pattern
export interface TemplatesPagedRaw {
  items?: { $values?: TemplateResponseRaw[] };
  totalCount?: number;
  pageNumber?: number;
  pageSize?: number;
}

export interface TemplateRecordUI {
  id: string; // stringified templateId
  templateId: number;
  name: string;
  owner: string;
  description: string;
  workflowId: number;
  createdDate: string; // ISO
  status: TemplateStatusUI;
  usageCount: number;
  isSequentialSigning: boolean; // normalized flag
}

export const mapTemplateRawToUI = (raw: TemplateResponseRaw): TemplateRecordUI => {
  return {
    id: String(raw.templateId),
    templateId: raw.templateId,
    name: raw.templateName || '-',
    owner: raw.templateOwner || '-',
    description: raw.templateDescription || '-',
    workflowId: raw.workflowId,
    createdDate: raw.createdOn,
    status: raw.templateStatus === TemplateStatusEnum.Active ? 'active' : 'draft',
    usageCount: raw.usageCount ?? 0,
    isSequentialSigning: !!raw.isSequentialSigningEnabled,
  };
};

export interface TemplatesUIResult {
  items: TemplateRecordUI[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

// ---------------- Template Details (single template) ----------------
// Raw shape inferred from backend entity includes (Template -> User, Documents -> TemplateRecipients -> TemplateRecipientField, TemplateDocumentFiles -> File)
// We define only properties we will consume; mark others optional for forward compatibility.

export interface TemplateDetailsRecipientFieldRaw {
  fieldId?: number;
  key?: string | null;
  value?: string | null;
  type?: string | null; // e.g., text/signature/date
  required?: boolean | null;
}

export interface TemplateDetailsRecipientRaw {
  templateRecipientId?: number;
  recipientRoleId?: number | null;
  recipientRoleName?: string | null; 
  defaultUserId?: string | null;
  defaultUserEmail?: string | null;
  defaultUserName?: string | null;
  orderingPriority?: number | null;
  templateRecipientField?: TemplateDetailsRecipientFieldRaw[] | null; 
}

export interface TemplateDetailsDocumentFileRaw {
  templateDocumentFileId?: number;
  fileId?: number;
  fileName?: string | null;
  fileSize?: number | null; // bytes
  fileType?: string | null; // mime
  uploadedOn?: string | null;
 
  file?: {
    fileId?: number;
    fileName?: string | null;
    fileSize?: number | null;
    fileType?: string | null;
  } | null;
}

export interface TemplateDetailsDocumentRaw {
  templateDocumentId?: number;
  documentOrder?: number | null;
  documentName?: string | null;
  createdOn?: string | null;
  templateRecipients?: TemplateDetailsRecipientRaw[] | { $values?: TemplateDetailsRecipientRaw[] } | null;
  templateDocumentFiles?: TemplateDetailsDocumentFileRaw[] | { $values?: TemplateDetailsDocumentFileRaw[] } | null;
  commonFields?: any[] | { $values?: any[] } | null; // new backend CommonFields (already deduped)
  CommonFields?: any[] | { $values?: any[] } | null; // PascalCase fallback
}

export interface TemplateDetailsRaw {
  templateId: number;
  templateName?: string | null;
  description?: string | null;
  createdOn?: string | null;
  isSequentialSigningEnabled?: boolean | null;
  user?: {
    userId?: string;
    fname?: string | null;
    lname?: string | null;
    email?: string | null;
  } | null;
 
  owner?: {
    userId?: string | null;
    name?: string | null;
    email?: string | null;
    role?: string | null;
    UserId?: string | null; 
    Name?: string | null;
    Email?: string | null;
    Role?: string | null;
  } | null;
  documents?: TemplateDetailsDocumentRaw[] | { $values?: TemplateDetailsDocumentRaw[] } | null;
}

export interface TemplateDetailsRecipientFieldUI {
  id: number | null;
  sourceFieldId?: number | null; 
  key: string;
  value: string;
  type: string;
  required: boolean;
  position?: string | null;
  x?: number | null;
  y?: number | null;
  page?: number | null;
  width?: number | null;
  height?: number | null;
  isCommonField?: boolean; 
}

export interface TemplateDetailsRecipientUI {
  id: number | null;
  roleId: number | null;
  roleName: string;
  defaultUserEmail: string;
  defaultUserName: string;
  orderingPriority: number | null;
  fields: TemplateDetailsRecipientFieldUI[];
}

export interface TemplateDetailsDocumentFileUI {
  id: number | null;
  fileId: number | null;
  name: string;
  size: number | null;
  type: string;
}

export interface TemplateDetailsDocumentUI {
  id: number | null;
  order: number | null;
  name: string;
  createdOn: string;
  files: TemplateDetailsDocumentFileUI[];
  recipients: TemplateDetailsRecipientUI[];
  commonFields: TemplateDetailsRecipientFieldUI[];
}

export interface TemplateDetailsUI {
  id: number;
  name: string;
  description: string;
  createdOn: string;
  ownerName: string;
  ownerEmail: string;
  ownerRole: string;
  isSequentialSigning: boolean;
  documents: TemplateDetailsDocumentUI[];
  totalRecipients: number;
  totalFields: number;
  totalFiles: number;
  usageCount?: number; // times template used in workflows
}

// Helper to normalize potential $values wrappers
const unwrap = <T,>(maybe: T[] | { $values?: T[] } | null | undefined): T[] => {
  if (!maybe) return [];
  if (Array.isArray(maybe)) return maybe;
  return maybe.$values ?? [];
};

export const mapTemplateDetailsRawToUI = (raw: TemplateDetailsRaw): TemplateDetailsUI => {
  const documentsRaw = unwrap(raw.documents);
  const documents: TemplateDetailsDocumentUI[] = documentsRaw.map(dr => {
    // Support both old and new DTO property names
    const recipientsSource: any = (dr as any).templateRecipients || (dr as any).recipients || (dr as any).TemplateRecipients || (dr as any).Recipients;
    const recipientsRaw = unwrap(recipientsSource);
    const recipients: TemplateDetailsRecipientUI[] = recipientsRaw.map(r => {
      const fieldsSource: any = (r as any).templateRecipientField || (r as any).fields || (r as any).TemplateRecipientField || (r as any).Fields;
      const fieldsRaw = unwrap(fieldsSource);
      const fields: TemplateDetailsRecipientFieldUI[] = fieldsRaw.map(f => {
        const positionRaw = (f as any).fieldPosition ?? (f as any).FieldPosition ?? null;
        let x: number | null = null;
        let y: number | null = null;
        let page: number | null = (f as any).page ?? null;
        let width: number | null = (f as any).width ?? null;
        let height: number | null = (f as any).height ?? null;
        if (positionRaw && typeof positionRaw === 'string' && positionRaw.includes(',')) {
          const parts = positionRaw.split(',').map(p => p.trim());
          const px = parseFloat(parts[0]);
          const py = parts.length > 1 ? parseFloat(parts[1]) : NaN;
          if (!Number.isNaN(px)) x = px;
          if (!Number.isNaN(py)) y = py;
          if (parts.length >= 3) {
            const pPage = parseInt(parts[2]); if (!Number.isNaN(pPage)) page = pPage;
          }
          if (parts.length >= 5) {
            const pW = parseFloat(parts[3]); const pH = parseFloat(parts[4]);
            if (!Number.isNaN(pW)) width = pW;
            if (!Number.isNaN(pH)) height = pH;
          }
        }
        return ({
          id: (f as any).recipientFieldId ?? (f as any).fieldId ?? null,
          sourceFieldId: (f as any).fieldId ?? null,
          key: (f as any).fieldName ?? (f as any).key ?? '-',
          value: (f as any).value ?? '',
          type: (f as any).fieldType ?? (f as any).type ?? 'text',
          required: !!((f as any).isRequired ?? (f as any).required),
          position: positionRaw,
          x,
          y,
          page: page,
          width: width,
          height: height,
          isCommonField: !!((f as any).isCommonField ?? (f as any).IsCommonField)
        });
      });
      return {
        id: (r as any).templateRecipientId ?? null,
        roleId: (r as any).recipientRoleId ?? null,
        roleName: (r as any).recipientRoleName ?? 'Recipient',
        defaultUserEmail: (r as any).defaultUserEmail ?? '-',
        defaultUserName: (r as any).defaultUserName ?? '-',
        orderingPriority: (r as any).orderingPriority ?? null,
        fields,
      };
    });
    const filesSource: any = (dr as any).templateDocumentFiles || (dr as any).files || (dr as any).TemplateDocumentFiles || (dr as any).Files;
    const filesRaw = unwrap(filesSource);
    const files: TemplateDetailsDocumentFileUI[] = filesRaw.map(f => ({
      id: (f as any).templateDocumentFileId ?? (f as any).id ?? null,
      fileId: (f as any).fileResourceId ?? (f as any).fileId ?? null,
      name: (f as any).fileName ?? 'File',
      size: (f as any).fileSize ?? null,
      type: (f as any).fileType ?? 'unknown',
    }));
    // Map common fields (backend now supplies a deduplicated list)
    const commonSource: any = (dr as any).commonFields || (dr as any).CommonFields;
    const commonRaw = unwrap(commonSource);
    const commonFields: TemplateDetailsRecipientFieldUI[] = commonRaw.map(cf => {
      const positionRaw = (cf as any).fieldPosition ?? (cf as any).FieldPosition ?? null;
      let x: number | null = null; let y: number | null = null; let page: number | null = null; let width: number | null = null; let height: number | null = null;
      if (positionRaw && typeof positionRaw === 'string' && positionRaw.includes(',')) {
        const parts = positionRaw.split(',').map(p => p.trim());
        const px = parseFloat(parts[0]); const py = parts.length > 1 ? parseFloat(parts[1]) : NaN;
        if (!Number.isNaN(px)) x = px; if (!Number.isNaN(py)) y = py;
        if (parts.length >= 3) { const pPage = parseInt(parts[2]); if (!Number.isNaN(pPage)) page = pPage; }
        if (parts.length >= 5) { const pW = parseFloat(parts[3]); const pH = parseFloat(parts[4]); if (!Number.isNaN(pW)) width = pW; if (!Number.isNaN(pH)) height = pH; }
      }
      return {
        id: (cf as any).fieldId ?? null,
        sourceFieldId: (cf as any).fieldId ?? null,
        key: (cf as any).fieldName ?? (cf as any).key ?? '-'
        , value: '',
        type: (cf as any).fieldType ?? (cf as any).type ?? 'text',
        required: !!((cf as any).isRequired ?? (cf as any).required),
        position: positionRaw,
        x, y, page, width, height,
        isCommonField: true
      };
    });
    return {
      id: (dr as any).templateDocumentId ?? (dr as any).documentId ?? null,
      order: (dr as any).documentOrder ?? null,
      name: (dr as any).documentName ?? (dr as any).title ?? 'Document',
      createdOn: (dr as any).createdOn ?? (dr as any).uploadedAt ?? raw.createdOn ?? '',
      files,
      recipients,
      commonFields,
    };
  });
  const ownerName = `${raw.user?.fname ?? ''} ${raw.user?.lname ?? ''}`.trim() || raw.user?.email || '-';
  const totalRecipients = documents.reduce((acc,d) => acc + d.recipients.length, 0);
  const totalFields = documents.reduce((acc,d) => acc + d.recipients.reduce((a,r) => a + r.fields.length,0) + d.commonFields.length,0);
  const totalFiles = documents.reduce((acc,d) => acc + d.files.length,0);

  const ownerObj: any = (raw as any).owner || (raw as any).Owner;
  const ownerNameFromOwner = ownerObj ? (ownerObj.name || ownerObj.Name || '') : '';
  const ownerEmailFromOwner = ownerObj ? (ownerObj.email || ownerObj.Email || '') : '';
  const ownerRoleFromOwner = ownerObj ? (ownerObj.role || ownerObj.Role || '') : '';
  const finalOwnerName = ownerName !== '-' && ownerName.trim().length > 0
    ? ownerName
    : (ownerNameFromOwner || ownerEmailFromOwner || '-');
  const finalOwnerEmail = raw.user?.email || ownerEmailFromOwner || '-';
  return {
    id: raw.templateId,
    name: raw.templateName ?? '-',
    description: raw.description ?? '-',
    createdOn: raw.createdOn ?? '',
    ownerName: finalOwnerName,
    ownerEmail: finalOwnerEmail,
  ownerRole: ownerRoleFromOwner || '-',
    isSequentialSigning: !!raw.isSequentialSigningEnabled,
    documents,
    totalRecipients,
    totalFields,
    totalFiles,
    usageCount: (raw as any).usageCount ?? undefined,
  };
};
