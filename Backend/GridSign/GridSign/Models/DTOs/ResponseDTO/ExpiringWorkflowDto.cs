using System;
using GridSign.Models.Entities;

namespace GridSign.Models.DTOs.ResponseDTO;

public class ExpiringWorkflowDto
{
    public int WorkflowId { get; set; }
    public string WorkflowName { get; set; } = string.Empty;
    public DateTime ValidUntil { get; set; }
    public int DaysRemaining { get; set; }
    public WorkflowStatus Status { get; set; }
    public int TemplateId { get; set; }
    public string TemplateName { get; set; } = string.Empty;
}