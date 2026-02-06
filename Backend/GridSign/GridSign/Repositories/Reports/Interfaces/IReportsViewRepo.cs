using GridSign.Models.Entities;

namespace GridSign.Repositories.Reports.Interfaces;

public interface IReportsViewRepo
{
    // Returns counts for each workflow status and recent workflows list (ordered desc by CreatedOn)
    // If workflowCreatorId is supplied, scope to that user's workflows; otherwise include all.
    (string status, string message, IDictionary<WorkflowStatus,int> counts, List<Workflow> recent, int total) GetWorkflowStatusCountsAndRecent(Guid? workflowCreatorId = null, int recentTake = 10);
    // Extended slices
    IEnumerable<IGrouping<DateTime, Workflow>> GetWorkflowsGroupedByDate(DateTime start, DateTime end, Guid? workflowCreatorId = null);
    IEnumerable<IGrouping<int, Workflow>> GetWorkflowsGroupedByTemplate(DateTime start, DateTime end, Guid? workflowCreatorId = null);
    IEnumerable<IGrouping<Guid, Workflow>> GetWorkflowsGroupedByCreator(DateTime start, DateTime end);
    List<Workflow> GetRecentWorkflowsInRange(DateTime start, DateTime end, Guid? workflowCreatorId = null, int take = 25);
}
