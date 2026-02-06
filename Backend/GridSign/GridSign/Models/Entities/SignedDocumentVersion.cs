using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GridSign.Models.Entities;

public class SignedDocumentVersion
{
    [Key]
    public int SignedDocumentVersionId { get; set; }

    [ForeignKey("WorkflowRecipientSignedDocument")]
    public int SignedDocumentId { get; set; }

    [ForeignKey("FileResource")]
    public int FileResourceId { get; set; }

    public int VersionNumber { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public WorkflowRecipientSignedDocument? WorkflowRecipientSignedDocument { get; set; }
    public FileResource? FileResource { get; set; }
}
