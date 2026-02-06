using System.Collections.Generic;

namespace GridSign.Models.DTOs.ResponseDTO;

public class ReportSummaryDto
{
    public int Total { get; set; }
    public int Completed { get; set; }
    public int InProgress { get; set; }
    public int Draft { get; set; }
    public int Expired { get; set; }
    public int Cancelled { get; set; } 
    public List<WorkflowSummaryDto> Recent { get; set; } = new();
}
