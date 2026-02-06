export interface Role {
  roleId: number;
  role: string;
  rolePriority: number;
}

export interface Field {
  fieldId: number;
  fieldType: string;
  fieldName: string;
  position: string;
  isRequired: boolean; 
  recipientId?: string;
}

// Request payload for completing a signing operation (subset since we use FormData)
export interface CompleteSigningRequestForm {
  RecipientId: number; // workflowRecipientId
  Token: string; // one-time signing token
  // signedDocument appended as File in FormData
}

export interface Recipient {
  email: string;
  name: string;
  deliveryType: number;
  role: Role;
  fields: Field[];
  templateRecipientId?: number | null;
  useDefaultUser?: boolean;
}

export interface WorkflowData {
  recipients: Recipient[];
  documentUrl?: string;
  documentName?: string;
}

// ---------------- Workflow Listing / API Models ----------------
// Mirrors backend DTOs (PascalCase) returned by .NET serialization.
// Updated to include Status (WorkflowStatus enum) and remove legacy IsCompleted inference.
export interface WorkflowSummaryDto {
  WorkFlowId: number;
  WorkFlowCreatorId: string; // Guid
  WorkflowOwnerName?: string;
  WorkflowName?: string;
  TemplateName?: string;
  CreatedOn: string; // DateTime ISO
  LastUpdatedDate: string; // DateTime ISO
  RecipientConfiguration: number; // enum numeric value
  Status: number; // WorkflowStatus enum numeric value
  ValidUntil: string; // DateOnly serialized (YYYY-MM-DD)
  IsCompleted: boolean;
  ReminderIntervalInDays: number;
}

export interface BasePagedResponseDto<T> {
  Items: T[];
  TotalCount: number;
  PageNumber: number;
  PageSize: number;
  HasPreviousPage: boolean;
  HasNextPage: boolean;
}

export interface ApiResponse<T> {
  Status: string;
  Message: string;
  Data: T;
}

// Actual raw API response (camelCase) as received from backend sample
export interface WorkflowSummaryRaw {
  workFlowId: number;
  workFlowCreatorId: string;
  workflowOwnerName?: string;
  workflowName?: string;
  templateId?: number | null;
  templateName?: string | null;
  createdOn: string;
  lastUpdatedDate: string;
  recipientConfiguration: number;
  status: number; // numeric WorkflowStatus enum
  validUntil: string; // YYYY-MM-DD
  isCompleted: boolean;
  isSequentialSigningEnabled?: boolean;
  reminderIntervalInDays: number;
}

export interface PagedResponseRaw<T> {
  items: { $values: T[] } | { $values?: T[] } | null;
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}

export interface ApiResponseRaw<T> {
  status: string;
  message: string;
  data: T;
}

// Request headers model for listing workflows (sent as headers per backend controller signature)
export interface GetWorkflowsRequestHeaders {
  PageNumber: number;
  PageSize: number;
  SearchTerm?: string;
  SortBy?: string;
  IsDescending: boolean;
  Status?: number; // WorkflowStatus enum numeric; optional filter
}

// Frontend normalized record used by views
// Canonical backend enum (mirrors C# WorkflowStatus)
// public enum WorkflowStatus { None=0, Draft=1, InProgress=2, Completed=3, Expired=4, Cancelled=5 }
export enum WorkflowStatusEnum {
  None = 0,
  Draft = 1,
  InProgress = 2,
  Completed = 3,
  Expired = 4,
  Cancelled = 5,
}

// UI status vocabulary. We retain "failed" as a legacy placeholder (maps to Expired) so existing UI code doesn't break
export interface WorkflowRecordUI {
  id: string;
  workflowName: string;
  creator: string;
  creatorId: string;
  status: "completed" | "in-progress" | "draft" | "expired" | "cancelled" | "failed"; // failed kept for backward compatibility
  templateName: string;
  templateId?: number | null;
  createdDate: string; // ISO
  updatedDate: string; // ISO
  recipientConfiguration: "from-template" | "custom-recipients" | "mixed" | "create-new-template";
  validUntil: string; // ISO date string (converted from DateOnly)
  reminderIntervalInDays: number;
  daysRemaining: number; // computed days until expiration (negative => expired)
  isExpired: boolean; // convenience flag
  isSequentialSigningEnabled: boolean;
}

// Mapping backend numeric enum value -> UI string token
export const backendToUiStatus: Record<number, WorkflowRecordUI["status"]> = {
  [WorkflowStatusEnum.None]: "draft", // treat None as draft-like in UI for listing context
  [WorkflowStatusEnum.Draft]: "draft",
  [WorkflowStatusEnum.InProgress]: "in-progress",
  [WorkflowStatusEnum.Completed]: "completed",
  [WorkflowStatusEnum.Expired]: "expired",
  [WorkflowStatusEnum.Cancelled]: "cancelled",
};

// Mapping UI token -> backend numeric enum (fallback to None if legacy value doesn't exist server-side)
export const uiStatusToBackend = (s: WorkflowRecordUI["status"]): number => {
  switch (s) {
    case "draft": return WorkflowStatusEnum.Draft;
    case "in-progress": return WorkflowStatusEnum.InProgress;
    case "completed": return WorkflowStatusEnum.Completed;
    case "expired": return WorkflowStatusEnum.Expired;
    case "cancelled": return WorkflowStatusEnum.Cancelled;
    // Legacy / placeholder: map failed to Expired until backend introduces explicit failure state
    case "failed": return WorkflowStatusEnum.Expired;
    default: return WorkflowStatusEnum.None;
  }
};

export const mapWorkflowSummaryToUI = (w: WorkflowSummaryDto): WorkflowRecordUI => {
  let status: WorkflowRecordUI["status"] = backendToUiStatus[w.Status] || "draft";
  // Respect IsCompleted override if backend hasn't updated Status yet
  if (w.IsCompleted && status !== "completed") status = "completed";
  const recipientConfig = mapRecipientConfiguration(w.RecipientConfiguration);
  const validUntilIso = toIsoDate(w.ValidUntil);
  const daysRemaining = computeDaysRemaining(validUntilIso);
  const expired = daysRemaining < 0;
  if (expired && status !== 'completed' && status !== 'cancelled') status = 'expired';
  return {
    id: `wf-${w.WorkFlowId}`,
    workflowName: w.WorkflowName || "Untitled Workflow",
    creator: w.WorkflowOwnerName || "Unknown",
    creatorId: w.WorkFlowCreatorId,
    status,
    templateName: w.TemplateName || 'N/A',
    createdDate: toIsoDateTime(w.CreatedOn),
    updatedDate: toIsoDateTime(w.LastUpdatedDate),
    recipientConfiguration: recipientConfig,
    validUntil: validUntilIso,
    reminderIntervalInDays: w.ReminderIntervalInDays ?? 0,
    daysRemaining,
    isExpired: expired,
    isSequentialSigningEnabled: false, // DTO version w/o raw flag; backend can add if needed
  };
};

export const mapWorkflowSummaryRawToUI = (w: WorkflowSummaryRaw): WorkflowRecordUI => {
  let status: WorkflowRecordUI["status"] = backendToUiStatus[w.status] || "draft";
  if (w.isCompleted && status !== 'completed') status = 'completed';
  const validUntilIso = toIsoDate(w.validUntil);
  const daysRemaining = computeDaysRemaining(validUntilIso);
  const expired = daysRemaining < 0;
  if (expired && status !== 'completed' && status !== 'cancelled') status = 'expired';
  return {
    id: `wf-${w.workFlowId}`,
    workflowName: w.workflowName || "Untitled Workflow",
    creator: w.workflowOwnerName || "Unknown",
    creatorId: w.workFlowCreatorId,
    status,
    templateName: (w.templateName && w.templateName.trim().length > 0) ? w.templateName : '-',
    templateId: w.templateId ?? null,
    createdDate: toIsoDateTime(w.createdOn),
    updatedDate: toIsoDateTime(w.lastUpdatedDate),
    recipientConfiguration: mapRecipientConfiguration(w.recipientConfiguration),
    validUntil: validUntilIso,
    reminderIntervalInDays: w.reminderIntervalInDays ?? 0,
    daysRemaining,
    isExpired: expired,
    isSequentialSigningEnabled: !!w.isSequentialSigningEnabled,
  };
};

// Recipient configuration enum mapping
export const mapRecipientConfiguration = (value: number): WorkflowRecordUI["recipientConfiguration"] => {
  switch (value) {
    case 0: return "from-template";
    case 1: return "custom-recipients";
    case 2: return "mixed";
    case 3: return "create-new-template";
    default: return "from-template";
  }
};

// Convert DateOnly (YYYY-MM-DD) to ISO date string at midnight local
export const toIsoDate = (dateOnly: string | undefined): string => {
  if (!dateOnly) return new Date().toISOString();
  // Preserve given date; assume format YYYY-MM-DD
  const parts = dateOnly.split('-');
  if (parts.length === 3) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toISOString();
  }
  const d = new Date(dateOnly);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

// Convert general DateTime string to ISO (pass-through if already ISO)
export const toIsoDateTime = (value: string | undefined): string => {
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

export const computeDaysRemaining = (iso: string): number => {
  const target = new Date(iso).getTime();
  const now = Date.now();
  return Math.ceil((target - now) / 86400000); // 86400000 ms in a day
};