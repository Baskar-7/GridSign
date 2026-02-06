namespace GridSign.Models.DTOs.RequestDTO;

public class CreateTemplateDto
{
    public string? DocumentName { get; set; }
    public string? Description { get; set; }
    public string? RecipientMessage { get; set; }
    public List<RecipientDto>? Recipients { get; set; }
    public List<FieldDto>? CommonFields { get; set; }
    public bool IsSequentialSigningEnabled { get; set; }
} 