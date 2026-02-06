namespace GridSign.Models.DTOs.RequestDTO;

public enum WorkflowActionType
{
    Start = 0,
    Cancel = 1
}

public class WorkflowActionRequestDto
{
    public int WorkflowId { get; set; }
    public WorkflowActionType Action { get; set; }
    // CancelReason removed per latest requirements
    public bool? AutoReminder { get; set; } // optional start-only flag
    public int? ReminderIntervalDays { get; set; } // optional start-only interval
}
