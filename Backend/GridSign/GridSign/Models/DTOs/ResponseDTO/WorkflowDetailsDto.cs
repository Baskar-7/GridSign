using GridSign.Models.Entities;
using GridSign.Models.DTOs.RequestDTO;

namespace GridSign.Models.DTOs.ResponseDTO;

// Refined workflow details DTO surface tailored for UI consumption
public class WorkflowDetailsDto
{
    public int WorkFlowId { get; set; }
    public string? WorkflowName { get; set; }
    public Guid WorkFlowCreatorId { get; set; }
    public string? WorkflowOwnerName { get; set; }
    public string? WorkflowOwnerEmail { get; set; }
    public WorkflowStatus Status { get; set; }
    public RecipientConfiguration RecipientConfiguration { get; set; }
    public DateOnly ValidUntil { get; set; }
    public int ReminderIntervalInDays { get; set; }
    public int TemplateId { get; set; }
    public string? TemplateName { get; set; }
    public string? TemplateDescription { get; set; }
    public DateTime? TemplateCreatedOn { get; set; }
    public bool IsSequentialSigningEnabled { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime LastUpdatedUtc { get; set; }

    public List<WorkflowRecipientDetailsDto> Recipients { get; set; } = new();
    public List<SignedDocumentDetailsDto> Documents { get; set; } = new();
    public WorkflowEmbeddedProgressDto? Progress { get; set; } // optional embedded snapshot
}

public class WorkflowRecipientDetailsDto
{
    public int WorkflowRecipientId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? Email { get; set; }
    public bool UseDefaultUser { get; set; }
    public int TemplateRecipientId { get; set; }
    public Guid? CustomUserId { get; set; }
    public string? ResolvedUserName { get; set; }
    public string? ResolvedUserEmail { get; set; }
    public int? RecipientRoleId { get; set; }
    public string? RecipientRoleName { get; set; }
    public int? RecipientRolePriority { get; set; }
    public int DeliveryType { get; set; }
    public EnvelopeStatus EnvelopeStatus { get; set; }
    public DateTime? EnvelopeSentAt { get; set; }
    public DateTime? EnvelopeCompletedAt { get; set; }
    public bool HasSigned { get; set; }
    public List<WorkflowRecipientSignatureDetailsDto> Signatures { get; set; } = new();
}

public class WorkflowRecipientSignatureDetailsDto
{
    public int RecipientSignatureId { get; set; }
    public bool IsSigned { get; set; }
    public DateTime? SignedAt { get; set; }
    public int SignedDocumentId { get; set; }
    public int LatestVersionNumber { get; set; }
    public List<SignedDocumentVersionDto> Versions { get; set; } = new();
}

public class SignedDocumentVersionDto
{
    public int SignedDocumentVersionId { get; set; }
    public int VersionNumber { get; set; }
    public DateTime CreatedAt { get; set; }
    public int FileResourceId { get; set; }
}

public class SignedDocumentDetailsDto
{
    public int SignedDocumentId { get; set; }
    public bool IsSharedDocument { get; set; }
    public int LatestVersionNumber { get; set; }
    public List<SignedDocumentVersionDto> Versions { get; set; } = new();
}

// Embedded lightweight progress snapshot to avoid second call if desired
public class WorkflowEmbeddedProgressDto
{
    public int TotalRecipients { get; set; }
    public int TotalEnvelopes { get; set; }
    public int SignedRecipients { get; set; }
    public int CompletedEnvelopes { get; set; }
    public double SignatureProgressPct { get; set; }
    public double EnvelopeProgressPct { get; set; }
    public double OverallProgressPct { get; set; }
}

// Full workflow progress snapshot (separate endpoint)
public class WorkflowProgressDto
{
    public int WorkflowId { get; set; }
    public EnvelopeProgressDto Envelopes { get; set; } = new();
    public RecipientProgressDto Recipients { get; set; } = new();
    public SignatureProgressDto Signatures { get; set; } = new();
    public ProgressPercentagesDto Percentages { get; set; } = new();
    public string OverallStatus { get; set; } = string.Empty;
    public DateTime LastUpdatedUtc { get; set; } = DateTime.UtcNow;
}

public class EnvelopeProgressDto
{
    public int Total { get; set; }
    public int Draft { get; set; }
    public int InProgress { get; set; }
    public int Completed { get; set; }
    public int Failed { get; set; }
    public int Expired { get; set; }
}

public class RecipientProgressDto
{
    public int Total { get; set; }
}

public class SignatureProgressDto
{
    public int Required { get; set; }
    public int Created { get; set; }
    public int Completed { get; set; }
}

public class ProgressPercentagesDto
{
    public double EnvelopeProgress { get; set; }
    public double SignatureProgress { get; set; }
    public double OverallProgress { get; set; }
}
