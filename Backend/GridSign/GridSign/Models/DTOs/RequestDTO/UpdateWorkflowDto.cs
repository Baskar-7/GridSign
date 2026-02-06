using GridSign.Models.Entities;

namespace GridSign.Models.DTOs.RequestDTO;

public enum WorkflowStatusDto
{ 
    Completed ,     // All tasks finished
    Expired ,       // Validity expired
    Cancelled       // Manually stopped
}

public class UpdateWorkflowDto
{
    public int  WorkFlowId{ get; set; }
    public string? WorkflowName { get; set; }
    public DateOnly ValidUntil { get; set; }
    public int ReminderIntervalInDays { get; set; }
}