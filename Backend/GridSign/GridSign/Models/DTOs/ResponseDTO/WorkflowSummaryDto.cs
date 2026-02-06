using GridSign.Models.DTOs.RequestDTO;
using GridSign.Models.Entities;

namespace GridSign.Models.DTOs.ResponseDTO;

public class WorkflowSummaryDto
{ 
    public int  WorkFlowId{ get; set; }
    public Guid WorkFlowCreatorId { get; set; } 
    public string? WorkflowOwnerName { get; set; }
    public string? WorkflowName { get; set; }
    public DateTime CreatedOn { get; set; }
    public DateTime LastUpdatedDate { get; set; }
    public RecipientConfiguration RecipientConfiguration { get; set; }
    public WorkflowStatus Status { get; set; } = WorkflowStatus.Draft;
    public DateOnly ValidUntil { get; set; } 
    public int ReminderIntervalInDays { get; set; }
    
    public int TemplateId { get; set; }
    public string TemplateName { get; set; }
    public bool IsSequentialSigningEnabled { get; set; }
   
}