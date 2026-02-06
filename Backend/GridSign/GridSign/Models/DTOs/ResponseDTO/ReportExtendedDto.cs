using System;
using System.Collections.Generic;
using GridSign.Models.DTOs.ResponseDTO;
using GridSign.Models.Entities;

namespace GridSign.Models.DTOs.ResponseDTO;

public class ReportExtendedDto
{
    public ReportSummaryDto? Summary { get; set; }
    public List<ActivityPoint> WeeklyActivity { get; set; } = new();
    public List<TemplateUsagePoint> TemplateUsage { get; set; } = new();
    public AveragesBlock Averages { get; set; } = new();
    public List<MetricsHistoryPoint> MetricsHistory { get; set; } = new();
    public List<UpcomingExpirationPoint> UpcomingExpirations { get; set; } = new();
    public DateTime RangeStart { get; set; }
    public DateTime RangeEnd { get; set; }
    public DateTime GeneratedAt { get; set; } = DateTime.UtcNow;
}

public class ActivityPoint { public DateTime Date { get; set; } public string DayLabel { get; set; } = string.Empty; public int Count { get; set; } }
public class TemplateUsagePoint { public int TemplateId { get; set; } public string TemplateName { get; set; } = string.Empty; public int Total { get; set; } public int Completed { get; set; } public double AvgCompletionDays { get; set; } public double SuccessRatePct { get; set; } }
public class MetricsHistoryPoint { public DateTime Date { get; set; } public int Total { get; set; } public int Completed { get; set; } public int InProgress { get; set; } public int Draft { get; set; } public int Expired { get; set; } public int Cancelled { get; set; } }
public class UpcomingExpirationPoint { public int WorkflowId { get; set; } public string WorkflowName { get; set; } = string.Empty; public DateTime ValidUntil { get; set; } public int DaysRemaining { get; set; } }
// Removed DailyStackedPoint, TopUserPoint, RecentEventPoint per request
public class AveragesBlock { public double AvgCompletionTimeDays { get; set; } public double CompletionRatePct { get; set; } }