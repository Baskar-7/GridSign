namespace GridSign.Models.DTOs.ResponseDTO;

/// Represents a single sign form (an envelope assigned to the current user needing or having completed action).
public class SignFormDto
{
    public string Id { get; set; } = string.Empty;          // Composite identifier (EnvelopeId or WorkflowId + RecipientId)
    public string Title { get; set; } = string.Empty;        // Workflow or document name
    public string Requester { get; set; } = string.Empty;    // Name of workflow owner / creator
    public DateTime RequestedAt { get; set; }                // When the envelope was issued (SentAt) or workflow creation fallback
    public DateTime? DueDate { get; set; }                   // Derived from workflow.ValidUntil
    public string Status { get; set; } = "Pending";          // Pending | Signed | Expired
    public int? Pages { get; set; }                          // Optional (reserved for future document analysis)
}
