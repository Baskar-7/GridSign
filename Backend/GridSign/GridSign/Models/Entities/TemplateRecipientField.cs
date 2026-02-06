using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GridSign.Models.Entities;

public class TemplateRecipientField
{
    [Key]
    public int RecipientFieldId { get; set; }

    [ForeignKey("TemplateRecipient")]
    public int RecipientId { get; set; }
    [ForeignKey("Field")]
    public int FieldId { get; set; }
    public bool IsCommonField { get; set; }
    public Field? Field { get; set; } 
    public TemplateRecipient? TemplateRecipient { get; set; } 
}