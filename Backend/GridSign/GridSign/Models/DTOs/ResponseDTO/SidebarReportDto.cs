using System;
using System.Collections.Generic;

namespace GridSign.Models.DTOs.ResponseDTO;

public class SidebarReportDto
{
    public QuickStatsBlock QuickStats { get; set; } = new();
    public List<ExpiringWorkflowDto> ExpiringWorkflows { get; set; } = new();
    public CompletionInsightBlock CompletionInsights { get; set; } = new();
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
}

public class QuickStatsBlock
{
    public int TotalDocuments { get; set; }
    public int Pending { get; set; }
    public int Completed { get; set; }
}

public class CompletionInsightBlock
{
    public double CompletionRatePct { get; set; }
    public double TrendDeltaPct { get; set; } // simple placeholder delta vs prior period
}