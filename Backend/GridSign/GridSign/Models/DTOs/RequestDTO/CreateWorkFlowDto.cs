using GridSign.Models.Entities;

namespace GridSign.Models.DTOs.RequestDTO;

public enum RecipientConfiguration
{
    FromTemplate,      // Use existing template recipients
    CustomRecipients,  // Use custom recipients only
    Mixed,             // Combine both template and custom recipients
    CreateNewTemplate  // Create a new template from this configuration
}


public class CreateWorkFlowDto 
{ 
    public RecipientConfiguration RecipientConfiguration  { get; set; }  = RecipientConfiguration.CreateNewTemplate;
    public int? TemplateId { get; set; }
    public DateOnly ValidTill { get; set; }  
    public bool AutoRemainder { get; set; }
    public int ReminderIntervalDays { get; set; }
    public bool IsSequentialSigningEnabled { get; set; }
    public string? DocumentName { get; set; }
    public string? Description { get; set; }
    public string? RecipientMessage{ get; set; }
    public List<RecipientDto>? Recipients { get; set; }
    public List<FieldDto>? CommonFields { get; set; }
    public bool StartImmediately { get; set; }
}