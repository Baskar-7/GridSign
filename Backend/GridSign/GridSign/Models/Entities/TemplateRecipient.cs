using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GridSign.Models.DTOs.RequestDTO;

namespace GridSign.Models.Entities;


public class TemplateRecipient
{
    [Key]
    public int TemplateRecipientId { get; set; } 
    [ForeignKey("TemplateDocument")] 
    public int TemplateDocumentId { get; set; } 
    [ForeignKey("RecipientRole")]
    public int RecipientRoleId { get; set; }
    [ForeignKey("Users")]
    public Guid? DefaultUserId { get; set; }

    public DeliveryType DeliveryType { get; set; } = DeliveryType.NeedsToSign;
    [MaxLength(255)]
    public string? Message { get; set; }
 
    public TemplateDocument?  TemplateDocument { get; set; }
    public Users? DefaultUser { get; set; } 
    public TemplateRecipientRole? RecipientRole { get; set; }

    public ICollection<TemplateRecipientField>? TemplateRecipientField { get; set; }
}
