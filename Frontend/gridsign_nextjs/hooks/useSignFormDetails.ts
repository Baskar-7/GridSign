import { useApiQuery } from '@/hooks/useApiQuery';

// Raw backend DTO (unwrapped from ApiResponse.data)
export interface SignFormFieldDto {
  fieldId: number;
  fieldType?: string;
  fieldName?: string;
  position?: string;
  isRequired: boolean;
  templateRecipientId?: number;
}
export interface SignFormRecipientDetailsDto {
  workflowRecipientId: number;
  templateRecipientId: number;
  name?: string;
  email?: string;
  roleName?: string;
  rolePriority: number;
  deliveryType: number; // enum mapped backend -> numeric index (NeedsToSign=0 etc.)
  useDefaultUser: boolean;
  envelopeStatus: string;
  isCurrentSigner: boolean;
  fields?: SignFormFieldDto[]; // backend now supplies per-recipient fields
}
export interface SignFormSigningDetailsDto {
  envelopeId: number;
  workflowId: number;
  templateId?: number;
  workflowName?: string;
  documentName?: string;
  requesterName?: string;
  requesterEmail?: string;
  envelopeStatus: string;
  workflowStatus: string;
  validUntil?: string; // ISO date
  isSequentialSigningEnabled: boolean;
  isExpired: boolean;
  alreadySigned: boolean;
  canSign: boolean;
  recipients: SignFormRecipientDetailsDto[];
  fields: SignFormFieldDto[];
}

// Normalized UI shapes (similar to previous inline mapping in sign page)
export interface SigningField {
  fieldId: number; fieldType: string; fieldName: string; position: string; isRequired: boolean; page: number; width?: number; height?: number; templateRecipientId?: number;
}
export interface SigningRecipient {
  workflowRecipientId: number; email: string; name: string; role: { roleId: number; role: string; rolePriority: number }; isCurrentSigner: boolean; fields: SigningField[]; envelopeStatus: string;
}
export interface SigningContext {
  documentName: string; pdfUrl: string; recipients: SigningRecipient[]; numPages: number; canSign: boolean; alreadySigned: boolean; isExpired: boolean; envelopeStatus: string;
}

// Placeholder until backend supplies document file resource
const PLACEHOLDER_PDF = '/contract.pdf';

/**
 * Hook: fetch sign form (envelope) signing details using unified useApiQuery pattern.
 * Mirrors pattern of workflow details retrieval.
 */
export function useSignFormDetails(envelopeId: number | null | undefined) {
  const enabled = typeof window !== 'undefined' && !!envelopeId && !Number.isNaN(envelopeId);
  return useApiQuery<SignFormSigningDetailsDto>({
    queryKey: ['sign-form-details', envelopeId],
    url: `/workflow/signForm/details?envelopeId=${envelopeId ?? ''}`,
    method: 'GET',
    enabled,
    staleTime: 15_000,
  });
}

/**
 * Derive a SigningContext from raw DTO (kept outside the hook so components can memoize as needed).
 */
export function mapSigningDetailsToContext(data: SignFormSigningDetailsDto | any | undefined): SigningContext | null {
  if (!data) return null;
  // Helper to unwrap EF Core $values arrays or return original
  const unwrapValues = (v: any): any => (v && typeof v === 'object' && Array.isArray(v.$values)) ? v.$values : v;

  // Case-flexible access helper (tries camelCase then PascalCase)
  const pick = (obj: any, keys: string[]): any => {
    for (const k of keys) { if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k]; }
    return undefined;
  };

  const rawRecipients = unwrapValues(pick(data, ['recipients', 'Recipients'])) || [];
  const recipientsSource: any[] = Array.isArray(rawRecipients) ? rawRecipients : [];

  const mapRawField = (f: any): SigningField => {
    const rawPos = pick(f, ['position','Position']) || '0,0';
    const parts = String(rawPos).split(',').map(p=>p.trim());
    const pageRaw = parts.length >= 3 ? parseInt(parts[2]) : 1;
    const page = Number.isNaN(pageRaw) ? 1 : pageRaw;
    const fieldId = pick(f, ['fieldId','FieldId']) || 0;
    const fieldType = pick(f, ['fieldType','FieldType']) || 'text';
    const fieldName = pick(f, ['fieldName','FieldName']) || 'Field';
    const isRequired = !!pick(f, ['isRequired','IsRequired']);
    const widthPart = parts.length >= 4 ? parseInt(parts[3]) : undefined;
    const heightPart = parts.length >= 5 ? parseInt(parts[4]) : undefined;
    const width = (widthPart && !Number.isNaN(widthPart)) ? widthPart : undefined;
    const height = (heightPart && !Number.isNaN(heightPart)) ? heightPart : undefined;
    const templateRecipientId = pick(f, ['templateRecipientId','TemplateRecipientId']);
    return { fieldId, fieldType, fieldName, position: parts.slice(0,2).join(','), isRequired, page, width, height, templateRecipientId };
  };

  let recipients: SigningRecipient[] = recipientsSource.map(r => {
    const rawRecipientFields = unwrapValues(pick(r, ['fields','Fields'])) || [];
    const recFieldsSrc: any[] = Array.isArray(rawRecipientFields) ? rawRecipientFields : [];
    const mappedRecFields = recFieldsSrc.map(mapRawField);
    return {
      workflowRecipientId: pick(r, ['workflowRecipientId','WorkflowRecipientId']) || 0,
      email: pick(r, ['email','Email']) || '',
      name: pick(r, ['name','Name']) || 'Unnamed',
      role: {
        roleId: pick(r, ['templateRecipientId','TemplateRecipientId']) || 0,
        role: pick(r, ['roleName','RoleName']) || 'Signer',
        rolePriority: pick(r, ['rolePriority','RolePriority']) || 0
      },
      isCurrentSigner: !!pick(r, ['isCurrentSigner','IsCurrentSigner']),
      envelopeStatus: pick(r, ['envelopeStatus','EnvelopeStatus']) || 'Unknown',
      fields: mappedRecFields
    };
  });

  // Aggregate top-level fields if provided (backend legacy) else derive from recipients
  // If we have a current signer, reduce recipients to ONLY that signer (optimization requested)
  const currentSignerList = recipients.filter(r => r.isCurrentSigner);
  if (currentSignerList.length > 0) {
    recipients = [currentSignerList[0]];
  } else if (recipients.length > 1) {
    // fallback heuristic: earliest rolePriority (lowest number) or first index
    const byPriority = [...recipients].sort((a,b)=> a.role.rolePriority - b.role.rolePriority);
    recipients = [byPriority[0]];
  }

  const rawFields = unwrapValues(pick(data, ['fields','Fields'])) || [];
  const fieldsSource: any[] = Array.isArray(rawFields) ? rawFields : [];
  const mappedFields: SigningField[] = fieldsSource.length > 0 ? fieldsSource.map(mapRawField) : recipients.flatMap(r=>r.fields);

  // Map common / shared fields (appear once on envelope) if backend supplies them
  const rawCommon = unwrapValues(pick(data, ['commonFields','CommonFields'])) || [];
  const commonFieldsSrc: any[] = Array.isArray(rawCommon) ? rawCommon : [];
  const mappedCommonFields: SigningField[] = commonFieldsSrc.map(mapRawField);

  const documentName = pick(data, ['documentName','DocumentName','workflowName','WorkflowName']) || `Envelope ${pick(data,['envelopeId','EnvelopeId'])}`;
  const canSign = !!pick(data, ['canSign','CanSign']);
  const alreadySigned = !!pick(data, ['alreadySigned','AlreadySigned']);
  const isExpired = !!pick(data, ['isExpired','IsExpired']);
  const envelopeStatus = pick(data, ['envelopeStatus','EnvelopeStatus']) || 'Unknown';

  return {
    documentName,
    pdfUrl: '', // defer actual PDF retrieval to template/file hooks on the signing page
    recipients,
    numPages: Math.max(mappedFields.reduce((mx,f)=> Math.max(mx,f.page), 1), 1),
    canSign: canSign && !alreadySigned && !isExpired,
    alreadySigned,
    isExpired,
    envelopeStatus,
    // Expose common fields so signing page can merge for current signer
    // (kept optional to avoid breaking existing consumers if any)
    // @ts-ignore backward compatible extension
    commonFields: mappedCommonFields
  };
}
