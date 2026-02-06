using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GridSign.Models.Entities;

public class WorkflowRecipientSignature
{
    [Key]
    public int RecipientSignatureId {get; set;}
    [ForeignKey("WorkflowRecipient")]
    public int WorkflowRecipientId { get; set; }
    [ForeignKey("WorkflowRecipientSignedDocument")]
    public int RecipientSignedDocumentId { get; set; }
    public bool IsSigned { get; set; } 
    public DateTime? SignedAt { get; set; }
    
    public WorkflowRecipient? WorkflowRecipient { get; set; }
    public required WorkflowRecipientSignedDocument WorkflowRecipientSignedDocument { get; set; }
}
