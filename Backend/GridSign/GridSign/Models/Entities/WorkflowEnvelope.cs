using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GridSign.Models.Entities;

public enum EnvelopeStatus
{
    Draft, 
    InProgress,
    Completed,
    Failed,
    Expired
}

public class WorkflowEnvelope
{
    [Key]
    public int WorkflowEnvelopeId { get; set; }

    [ForeignKey("Workflow")]
    public int WorkflowId { get; set; }

    public EnvelopeStatus Status { get; set; } = EnvelopeStatus.Draft;
    public DateTime? SentAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    public Workflow? Workflow { get; set; } 
    
    public WorkflowRecipient? WorkflowRecipient { get; set; }
}
