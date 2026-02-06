namespace GridSign.Models.DTOs.ResponseDTO;

public enum TemplateStatus
{
    Draft,
    Active,
}

public class TemplatesResponseDto
{
    public int TemplateId { get; set; }
    public string? TemplateName { get; set; }
    public string? TemplateOwner { get; set; }
    public int WorkflowId { get; set; } 
    public string? TemplateDescription { get; set; }
    public DateTime CreatedOn { get; set; }
    public TemplateStatus TemplateStatus { get; set; }
    public int UsageCount { get; set; } 
    public bool IsSequentialSigningEnabled { get; set; }
}