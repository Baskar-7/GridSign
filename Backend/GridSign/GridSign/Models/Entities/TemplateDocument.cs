using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GridSign.Models.Entities;

public class TemplateDocument
{
    [Key]
    public int DocumentId { get; set; }
    [ForeignKey("Templates")]
    public int TemplateId { get; set; }
    [MaxLength(255)]
    public string? Title { get; set; } 
    public DateTime UploadedAt { get; set; }
    
    public Template? Template { get; set; }
    
    public ICollection<TemplateRecipient>? TemplateRecipients { get; set; }
    public ICollection<TemplateDocumentFiles>? TemplateDocumentFiles { get; set; }
    
}