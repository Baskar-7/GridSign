using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GridSign.Models.Entities;

public class WorkflowSignatureProof
{
    [Key,ForeignKey("RecipientSignature")]
    public int SignatureProofId { get; set; }
 
    [ForeignKey("FileResource")]
    public int FileResourceId { get; set; }

    public FileResource? File { get; set; } 
    public WorkflowRecipientSignature? RecipientSignature { get; set; }
}
