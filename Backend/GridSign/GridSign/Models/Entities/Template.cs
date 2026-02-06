using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GridSign.Models.DTOs.ResponseDTO;

namespace GridSign.Models.Entities;

public class Template
{
    [Key]
    public int TemplateId { get; set; }
    [MaxLength(255)]
    [ForeignKey("Users")]
    public Guid TemplateOwner {get; set;}
    public bool IsSequentialSigningEnabled { get; set; }
    [MaxLength(255)]
    public string? TemplateName { get; set; }
    [MaxLength(255)]
    public string? Description { get; set; }
    public DateTime CreatedOn { get; set; }

    public Users? Users { get; set; }
    public ICollection<TemplateDocument>? Documents { get; set; }

    // Not mapped runtime metric:  
    [NotMapped]
    public int UsageCount { get; set; }
    [NotMapped]
    public TemplateStatus TemplateStatus { get; set; }
}