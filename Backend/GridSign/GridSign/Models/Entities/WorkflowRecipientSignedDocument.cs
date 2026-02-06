using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GridSign.Models.Entities;

public class WorkflowRecipientSignedDocument
{
    [Key]
    public int SignedDocumentId { get; set; }
    [ForeignKey("Workflow")]
    public int WorkflowId { get; set; } 
    public bool IsSharedDocument { get; set; }  

    public Workflow Workflow { get; set; } = null!; 
    
    public ICollection<WorkflowRecipientSignature> Signatures { get; set; } = new List<WorkflowRecipientSignature>();
    public ICollection<SignedDocumentVersion>  SignedDocumentVersions { get; set; } = new List<SignedDocumentVersion>();
}