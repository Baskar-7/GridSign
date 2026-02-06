/**
 * Standardized API Response Types
 *
 * All API endpoints return responses in this format:
 * { status: string, message: string, data: any }
 */

/**
 * Standard API response structure
 * @template T - The type of data returned in the response
 */
export interface ApiResponse<T = any> {
    /**
     * Status of the response
     * Common values: "success", "error", "warning", "info"
     */
    status: "success" | "error" | "warning" | "info" | string;

    /**
     * Human-readable message describing the response
     */
    message: string;

    /**
     * The actual data payload
     */
    data: T;
}

/**
 * Type guard to check if a value is an ApiResponse
 */
export function isApiResponse(value: any): value is ApiResponse {
    return (
        value !== null &&
        typeof value === "object" &&
        "status" in value &&
        "message" in value &&
        "data" in value
    );
}

/**
 * Helper to create a successful API response
 */
export function createSuccessResponse<T>(
    message: string,
    data: T
): ApiResponse<T> {
    return {
        status: "success",
        message,
        data,
    };
}

/**
 * Helper to create an error API response
 */
export function createErrorResponse(message: string): ApiResponse<null> {
    return {
        status: "error",
        message,
        data: null,
    };
}

// Workflow progress DTOs matching backend structure
export interface WorkflowProgressDto {
    workflowId: number;
    envelopes: EnvelopeProgressDto;
    recipients: RecipientProgressDto;
    signatures: SignatureProgressDto;
    percentages: ProgressPercentagesDto;
    overallStatus: string;
    lastUpdatedUtc: string;
}

export interface EnvelopeProgressDto {
    total: number;
    draft: number;
    inProgress: number;
    completed: number; // raw completed count
    failed: number;
    expired: number;
}

export interface RecipientProgressDto {
    total: number;
}

export interface SignatureProgressDto {
    required: number;
    created: number;
    completed: number;
}

export interface ProgressPercentagesDto {
    envelopeProgress: number;
    signatureProgress: number;
    overallProgress: number;
}

// Refined workflow details DTO (frontend mirror of backend WorkflowDetailsDto)
export interface WorkflowDetailsDto {
    workFlowId: number;
    workflowName?: string;
    workFlowCreatorId: string;
    workflowOwnerName?: string;
    workflowOwnerEmail?: string;
    status: number; // WorkflowStatus enum numeric
    recipientConfiguration: number; // RecipientConfiguration enum numeric
    validUntil: string; // DateOnly string
    reminderIntervalInDays: number;
    templateId: number;
    templateName?: string;
    templateDescription?: string;
    templateCreatedOn?: string;
    isSequentialSigningEnabled?: boolean;
    createdAtUtc: string;
    lastUpdatedUtc: string;
    recipients: WorkflowRecipientDetailsDto[];
    // envelopes removed to slim payload
    documents: SignedDocumentDetailsDto[];
    progress?: WorkflowEmbeddedProgressDto;
}

export interface WorkflowRecipientDetailsDto {
    workflowRecipientId: number;
    displayName: string;
    email?: string | null;
    useDefaultUser: boolean;
    templateRecipientId: number;
    customUserId?: string | null;
    resolvedUserName?: string | null;
    resolvedUserEmail?: string | null;
    recipientRoleId?: number | null;
    recipientRoleName?: string | null;
    recipientRolePriority?: number | null;
    deliveryType: number;
    envelopeStatus: number; // EnvelopeStatus numeric
    envelopeSentAt?: string | null;
    envelopeCompletedAt?: string | null;
    hasSigned: boolean;
    signatures: WorkflowRecipientSignatureDetailsDto[];
}

export interface WorkflowRecipientSignatureDetailsDto {
    recipientSignatureId: number;
    isSigned: boolean;
    signedAt?: string | null;
    signedDocumentId: number;
    latestVersionNumber: number;
    versions: SignedDocumentVersionDto[];
}

export interface SignedDocumentVersionDto {
    signedDocumentVersionId: number;
    versionNumber: number;
    createdAt: string;
    fileResourceId: number;
}

export interface SignedDocumentDetailsDto {
    signedDocumentId: number;
    isSharedDocument: boolean;
    latestVersionNumber: number;
    versions: SignedDocumentVersionDto[];
}

export interface WorkflowEmbeddedProgressDto {
    totalRecipients: number;
    totalEnvelopes: number;
    signedRecipients: number;
    completedEnvelopes: number;
    signatureProgressPct: number;
    envelopeProgressPct: number;
    overallProgressPct: number;
}
