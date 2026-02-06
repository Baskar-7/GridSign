using System.ComponentModel.DataAnnotations;

namespace GridSign.Models.DTOs.RequestDTO;

/// <summary>
/// Request payload for bulk "Remind Now" operation on a workflow.
/// Sends reminder emails to all pending (InProgress) recipients.
/// </summary>
public class RemindAllWorkflowRequestDto
{
    [Required]
    public int WorkflowId { get; set; }
}
