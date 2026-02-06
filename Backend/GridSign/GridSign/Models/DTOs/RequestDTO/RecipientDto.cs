using GridSign.Models.Entities;

namespace GridSign.Models.DTOs.RequestDTO;

public enum DeliveryType
{
    NeedsToSign,
    ReceivesACopy
}
public class RecipientDto
{
    public string? Email { get; set; }
    public string? Name { get; set; }
    public bool UseDefaultUser { get; set; } = false; 
    public int? TemplateRecipientId { get; set; }
    public DeliveryType DeliveryType { get; set; } = DeliveryType.NeedsToSign;
    public TemplateRecipientRole? Role { get; set; } 
    
    public List<FieldDto>? Fields { get; set; }
}