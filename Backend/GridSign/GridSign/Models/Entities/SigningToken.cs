using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GridSign.Models.Entities;

/// <summary>
/// One-time access token used to authorize a recipient to open the signing page for a specific workflow recipient/envelope.
/// Independent of Verification records so multiple email/password/reset tokens are not overwritten.
/// </summary>
public class SigningToken
{
    [Key]
    public int SigningTokenId { get; set; } 
    public int WorkflowRecipientId { get; set; } 
    [Required]
    public string Token { get; set; } = string.Empty; 
    public DateTime ExpiresAt { get; set; } 
    public bool IsUsed { get; set; }

    [ForeignKey("WorkflowRecipientId")]
    public WorkflowRecipient? WorkflowRecipient { get; set; }
}
