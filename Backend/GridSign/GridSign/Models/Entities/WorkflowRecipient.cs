using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Google.Apis.Drive.v3.Data;
using GridSign.Models.DTOs.RequestDTO;

namespace GridSign.Models.Entities;

public enum EmailStatus
{
    Pending,
    Sent,
    Failed
}

public class WorkflowRecipient
{
    [Key]
    public int WorkflowRecipientId { get; set; }
    [ForeignKey("WorkflowEnvelope")]
    public int EnvelopeId { get; set; }
    public bool UseDefaultUser { get; set; } = false; 
    [ForeignKey("TemplateRecipient")]
    public int TemplateRecipientId { get; set; }  
    [ForeignKey("User")]
    public Guid? CustomUser { get; set; }
    public EmailStatus EmailStatus { get; set; } = EmailStatus.Pending;

    public required WorkflowEnvelope WorkflowEnvelope { get; set; }
    public TemplateRecipient? TemplateRecipient { get; set; }
    public Users? User { get; set; }

    public ICollection<WorkflowRecipientSignature>? RecipientSignatures { get; set; }
}
