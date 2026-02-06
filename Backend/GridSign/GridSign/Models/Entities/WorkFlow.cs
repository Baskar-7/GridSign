using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using GridSign.Models.DTOs.RequestDTO;

namespace GridSign.Models.Entities;

public enum WorkflowStatus
{
    None ,
    Draft ,         // Workflow created but not started
    InProgress ,    // Currently being processed / signed 
    Completed ,     // All tasks finished
    Expired ,       // Validity expired
    Cancelled       // Manually stopped
}


public class Workflow
{
    [Key]
    public int  WorkFlowId{ get; set; }
    [ForeignKey("Template")]
    public int TemplateId { get; set; }
    [MaxLength(100)]
    public string? WorkflowName { get; set; }
    [ForeignKey("User")]
    public Guid WorkFlowCreator { get; set; } 
    public DateTime CreatedOn { get; set; }
    public DateTime LastUpdatedDate { get; set; }
    public RecipientConfiguration RecipientConfiguration  { get; set; } = RecipientConfiguration.FromTemplate;
    public WorkflowStatus Status { get; set; } = WorkflowStatus.Draft;
    public DateOnly ValidUntil { get; set; }
    public int ReminderIntervalInDays { get; set; }
    
    public Users? User { get; set; }
    public Template? Template { get; set; }
    
    public ICollection<WorkflowEnvelope> WorkflowEnvelopes { get; set; } = new List<WorkflowEnvelope>();
}
