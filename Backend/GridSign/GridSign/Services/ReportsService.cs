using GridSign.Models.DTOs.ResponseDTO;
using GridSign.Repositories.Reports.Interfaces;
using GridSign.Services.Interfaces;
using GridSign.Models.Entities;
using GridSign.Services.ServiceHelper.Interfaces;

namespace GridSign.Services;

using AutoMapper;

public class ReportsService(IReportsViewRepo reportsViewRepo,IUserContext currUser, IMapper mapper) : IReportsService
{
    private Guid GetCurrentUserId()
    {
        var currentUser = currUser.GetCurrentUser();
        if (currentUser == null || string.IsNullOrWhiteSpace(currentUser.UserId))
            throw new Exception("User is not logged in..");
        return new Guid(currentUser.UserId);
    }

    private ReportSummaryDto MapWorkflowSummary(IDictionary<WorkflowStatus,int> counts, List<Workflow> recent, int total)
    {
        return new ReportSummaryDto
        {
            Total = total,
            Completed = counts.TryGetValue(WorkflowStatus.Completed, out var c) ? c : 0,
            InProgress = counts.TryGetValue(WorkflowStatus.InProgress, out var ip) ? ip : 0,
            Draft = counts.TryGetValue(WorkflowStatus.Draft, out var d) ? d : 0,
            Expired = counts.TryGetValue(WorkflowStatus.Expired, out var ex) ? ex : 0,
            Cancelled = counts.TryGetValue(WorkflowStatus.Cancelled, out var ca) ? ca : 0,
            Recent = mapper.Map<List<WorkflowSummaryDto>>(recent)
        };
    }

    private List<ExpiringWorkflowDto> BuildExpiringSubset(IEnumerable<IGrouping<DateTime, Workflow>> groupedByDate, DateTime today, int windowDays, int limit)
    {
        var windowEnd = today.AddDays(windowDays);
        var workflows = groupedByDate.SelectMany(g => g)
            .Where(w => w.ValidUntil >= DateOnly.FromDateTime(today) && w.ValidUntil <= DateOnly.FromDateTime(windowEnd) && w.Status != WorkflowStatus.Completed && w.Status != WorkflowStatus.Cancelled)
            .OrderBy(w => w.ValidUntil)
            .Take(limit)
            .ToList();
        var mapped = mapper.Map<List<ExpiringWorkflowDto>>(workflows);
        foreach (var m in mapped)
        {
            var entity = workflows.First(w => w.WorkFlowId == m.WorkflowId);
            m.DaysRemaining = (int)Math.Ceiling((entity.ValidUntil.ToDateTime(TimeOnly.MinValue) - today).TotalDays);
            m.WorkflowName = string.IsNullOrWhiteSpace(m.WorkflowName) ? $"Workflow {m.WorkflowId}" : m.WorkflowName;
            m.ValidUntil = entity.ValidUntil.ToDateTime(TimeOnly.MinValue);
        }
        return mapped;
    }

    public ApiResponse<ReportExtendedDto> GetExtendedReport(string? dateRange = null)
    {
        var resp = new ApiResponse<ReportExtendedDto>();
        try
        {
            var userId = GetCurrentUserId();

            // Determine range
            var now = DateTime.UtcNow.Date;
            var (start, end) = dateRange switch
            {
                "30d" => (now.AddDays(-29), now),
                "90d" => (now.AddDays(-89), now),
                "1y" => (now.AddYears(-1).AddDays(1), now),
                _ => (now.AddDays(-6), now) // default 7d
            };

            // Base summary (reuse existing logic)
            var (status, msg, counts, recent, total) = reportsViewRepo.GetWorkflowStatusCountsAndRecent(userId, 15);
            var summary = MapWorkflowSummary(counts, recent, total);

            // Weekly activity (group by date for range)
            var groupedByDate = reportsViewRepo.GetWorkflowsGroupedByDate(start, end, userId);
            var activity = new List<ActivityPoint>();
            var iterDate = start;
            while (iterDate <= end)
            {
                var grp = groupedByDate.FirstOrDefault(g => g.Key == iterDate);
                activity.Add(new ActivityPoint { Date = iterDate, DayLabel = iterDate.ToString("ddd"), Count = grp?.Count() ?? 0 });
                iterDate = iterDate.AddDays(1);
            }

            // Template usage
            var groupedTemplates = reportsViewRepo.GetWorkflowsGroupedByTemplate(start, end, userId);
            // Build a lookup from recent summary (already has TemplateName populated)
            var recentTemplateLookup = summary.Recent
                .Where(r => r.TemplateId > 0 && !string.IsNullOrWhiteSpace(r.TemplateName))
                .GroupBy(r => r.TemplateId)
                .ToDictionary(g => g.Key, g => g.First().TemplateName!);

            var templateUsage = groupedTemplates.Select(g => {
                var completedSubset = g.Where(w => w.Status == WorkflowStatus.Completed).ToList();
                double avgDays = 0;
                if (completedSubset.Count > 0)
                {
                    avgDays = completedSubset
                        .Select(w => (w.LastUpdatedDate - w.CreatedOn).TotalDays)
                        .Where(d => d >= 0)
                        .DefaultIfEmpty(0)
                        .Average();
                }
                var successRate = g.Count() > 0 ? (double)completedSubset.Count / g.Count() * 100.0 : 0;
                // Prefer: navigation Template name, then recent summary lookup, then explicit fallbacks
                var navName = g.FirstOrDefault()?.Template?.TemplateName;
                string resolvedName = navName
                    ?? (recentTemplateLookup.TryGetValue(g.Key, out var recentName) ? recentName : null)
                    ?? (g.Key == 0 ? "(No Template)" : "(Unknown Template)");
                return new TemplateUsagePoint
                {
                    TemplateId = g.Key,
                    TemplateName = resolvedName,
                    Total = g.Count(),
                    Completed = completedSubset.Count,
                    AvgCompletionDays = Math.Round(avgDays, 2),
                    SuccessRatePct = Math.Round(successRate, 2)
                };
            }).OrderByDescending(t => t.Total).ToList();
            // Metrics history (per day status counts)
            var metricsHistory = (from dayGroup in groupedByDate
            let date = dayGroup.Key
            select new MetricsHistoryPoint
            {
                Date = date,
                Total = dayGroup.Count(),
                Completed = dayGroup.Count(w => w.Status == WorkflowStatus.Completed),
                InProgress = dayGroup.Count(w => w.Status == WorkflowStatus.InProgress),
                Draft = dayGroup.Count(w => w.Status == WorkflowStatus.Draft),
                Expired = dayGroup.Count(w => w.Status == WorkflowStatus.Expired),
                Cancelled = dayGroup.Count(w => w.Status == WorkflowStatus.Cancelled)
            }).ToList();
            // Fill missing days with zeros to keep continuity
            var cursor = start;
            while (cursor <= end)
            {
                if (metricsHistory.All(m => m.Date != cursor))
                {
                    metricsHistory.Add(new MetricsHistoryPoint { Date = cursor });
                }
                cursor = cursor.AddDays(1);
            }
            metricsHistory = metricsHistory.OrderBy(m => m.Date).ToList();

            // Upcoming expirations (next 14 days, not completed/cancelled)
            var upcomingExpirations = BuildExpiringSubset(groupedByDate, DateTime.UtcNow.Date, 14, 50)
                .Select(w => new UpcomingExpirationPoint
                {
                    WorkflowId = w.WorkflowId,
                    WorkflowName = w.WorkflowName,
                    ValidUntil = w.ValidUntil,
                    DaysRemaining = w.DaysRemaining
                }).ToList();

            // Averages block
            var completedAll = groupedByDate.SelectMany(g => g.Where(w => w.Status == WorkflowStatus.Completed)).ToList();
            double avgCompletionDays = 0;
            if (completedAll.Count > 0)
            {
                avgCompletionDays = completedAll.Select(w => (w.LastUpdatedDate - w.CreatedOn).TotalDays).Where(d => d >= 0).DefaultIfEmpty(0).Average();
            }
            var completionRatePct = summary.Total > 0 ? (double)summary.Completed / summary.Total * 100.0 : 0;

            var extended = new ReportExtendedDto
            {
                Summary = summary,
                WeeklyActivity = activity,
                TemplateUsage = templateUsage,
                MetricsHistory = metricsHistory,
                UpcomingExpirations = upcomingExpirations,
                Averages = new AveragesBlock { AvgCompletionTimeDays = Math.Round(avgCompletionDays, 2), CompletionRatePct = Math.Round(completionRatePct, 2) },
                RangeStart = start,
                RangeEnd = end
            };

            resp.Data = extended;
            resp.Status = status == "success" ? "success" : "partial";
            resp.Message = status == "success" ? msg : "Extended report generated with partial summary";
        }
        catch (Exception ex)
        {
            resp.Status = "error";
            resp.Message = ex.Message;
        }
        return resp;
    }


    public ApiResponse<SidebarReportDto> GetSidebarReport(int expiringDays = 14, int expiringLimit = 8)
    {
        var resp = new ApiResponse<SidebarReportDto>();
        try
        {
            var userId = GetCurrentUserId();

            // Base counts & recent (reuse existing repo method for counts only)
            var (_, _, counts, recent, total) = reportsViewRepo.GetWorkflowStatusCountsAndRecent(userId, 5);
            var completed = counts.TryGetValue(WorkflowStatus.Completed, out var c) ? c : 0;
            var inProgress = counts.TryGetValue(WorkflowStatus.InProgress, out var ip) ? ip : 0;
            var draft = counts.TryGetValue(WorkflowStatus.Draft, out var d) ? d : 0;
            var expired = counts.TryGetValue(WorkflowStatus.Expired, out var ex) ? ex : 0;
            var cancelled = counts.TryGetValue(WorkflowStatus.Cancelled, out var ca) ? ca : 0;

            // Completion rate (simple) & faux trend delta (compare last 7d vs previous 7d)
            double completionRate = total > 0 ? (double)completed / total * 100.0 : 0;
            var now = DateTime.UtcNow.Date;
            var last7Start = now.AddDays(-6);
            var prev7Start = now.AddDays(-13);
            var last7Groups = reportsViewRepo.GetWorkflowsGroupedByDate(last7Start, now, userId);
            var prev7Groups = reportsViewRepo.GetWorkflowsGroupedByDate(prev7Start, last7Start.AddDays(-1), userId);
            var last7Completed = last7Groups.SelectMany(g => g).Count(w => w.Status == WorkflowStatus.Completed);
            var prev7Completed = prev7Groups.SelectMany(g => g).Count(w => w.Status == WorkflowStatus.Completed);
            double trendDelta = prev7Completed > 0 ? ((double)(last7Completed - prev7Completed) / prev7Completed) * 100.0 : (last7Completed > 0 ? 100.0 : 0);

            // Expiring workflows subset
            var groupedByDate = reportsViewRepo.GetWorkflowsGroupedByDate(now.AddYears(-1), now, userId);
            var expiring = BuildExpiringSubset(groupedByDate, now, expiringDays, expiringLimit);

            var sidebar = new SidebarReportDto
            {
                QuickStats = new QuickStatsBlock
                {
                    TotalDocuments = total,
                    Pending = inProgress + draft,
                    Completed = completed
                },
                CompletionInsights = new CompletionInsightBlock
                {
                    CompletionRatePct = Math.Round(completionRate, 2),
                    TrendDeltaPct = Math.Round(trendDelta, 2)
                },
                ExpiringWorkflows = expiring
            };

            resp.Data = sidebar;
            resp.Status = "success";
            resp.Message = "Sidebar report generated";
        }
        catch (Exception ex)
        {
            resp.Status = "error";
            resp.Message = ex.Message;
        }
        return resp;
    }
}
