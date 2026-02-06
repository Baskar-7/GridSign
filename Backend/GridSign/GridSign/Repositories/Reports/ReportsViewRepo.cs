using GridSign.Data;
using GridSign.Helpers;
using GridSign.Models.Entities;
using GridSign.Repositories.Reports.Interfaces;
using GridSign.Repositories.RepoHelper;
using Microsoft.EntityFrameworkCore;

namespace GridSign.Repositories.Reports;

public class ReportsViewRepo(ApplicationDbContext dbContext) : RepoUtility(dbContext), IReportsViewRepo
{
    public (string status, string message, IDictionary<WorkflowStatus,int> counts, List<Workflow> recent, int total) GetWorkflowStatusCountsAndRecent(Guid? workflowCreatorId = null, int recentTake = 10)
    {
        var status = "error"; var message = "Failed to generate report";
        var counts = new Dictionary<WorkflowStatus,int>();
        var recent = new List<Workflow>();
        var total = 0;
        try
        {
            // Base query (future: scope by tenant / user if needed)
            var wfQuery = DbContext.Workflow.AsNoTracking();
            if (workflowCreatorId.HasValue)
            {
                wfQuery = wfQuery.Where(w => w.WorkFlowCreator == workflowCreatorId.Value);
            }
            total = wfQuery.Count();

            // Group counts per status efficiently server-side
            counts = wfQuery
                .GroupBy(w => w.Status)
                .Select(g => new { g.Key, Cnt = g.Count() })
                .ToDictionary(x => x.Key, x => x.Cnt);

            // Recent ordered by creation
            recent = wfQuery
                .Include(w => w.User)
                .Include(w => w.Template)
                .OrderByDescending(w => w.CreatedOn)
                .Take(recentTake)
                .ToList();

            status = "success"; message = "Report data retrieved";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message, counts, recent, total);
    }

    public IEnumerable<IGrouping<DateTime, Workflow>> GetWorkflowsGroupedByDate(DateTime start, DateTime end, Guid? workflowCreatorId = null)
    {
        var q = DbContext.Workflow.AsNoTracking().Where(w => w.CreatedOn >= start && w.CreatedOn <= end);
        if (workflowCreatorId.HasValue) q = q.Where(w => w.WorkFlowCreator == workflowCreatorId.Value);
        // Group by date (date component only)
        return q.GroupBy(w => w.CreatedOn.Date).ToList();
    }

    public IEnumerable<IGrouping<int, Workflow>> GetWorkflowsGroupedByTemplate(DateTime start, DateTime end, Guid? workflowCreatorId = null)
    {
        var q = DbContext.Workflow.AsNoTracking().Where(w => w.CreatedOn >= start && w.CreatedOn <= end);
        if (workflowCreatorId.HasValue) q = q.Where(w => w.WorkFlowCreator == workflowCreatorId.Value);
        return q.GroupBy(w => w.TemplateId).ToList();
    }

    public IEnumerable<IGrouping<Guid, Workflow>> GetWorkflowsGroupedByCreator(DateTime start, DateTime end)
    {
        var q = DbContext.Workflow.AsNoTracking().Where(w => w.CreatedOn >= start && w.CreatedOn <= end);
        return q.GroupBy(w => w.WorkFlowCreator).ToList();
    }

    public List<Workflow> GetRecentWorkflowsInRange(DateTime start, DateTime end, Guid? workflowCreatorId = null, int take = 25)
    {
        var q = DbContext.Workflow.AsNoTracking().Where(w => w.CreatedOn >= start && w.CreatedOn <= end);
        if (workflowCreatorId.HasValue) q = q.Where(w => w.WorkFlowCreator == workflowCreatorId.Value);
        return q.OrderByDescending(w => w.LastUpdatedDate).Take(take)
            .Include(w => w.Template)
            .ToList();
    }
}
