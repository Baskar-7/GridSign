using System.ComponentModel.DataAnnotations; 

namespace GridSign.Models.Entities;

public class Field
{
    [Key]
    public int FieldId { get; set; } 
    [MaxLength(255)]
    public required string FieldType { get; set; }
    [MaxLength(255)]
    public required string FieldName { get; set; }
    [MaxLength(255)]
    public required string FieldPosition { get; set; } 
    public bool IsRequired { get; set; }

    public TemplateDocument? Document { get; set; } 
    public ICollection<TemplateRecipientField>? RecipientFields { get; set; }
}
