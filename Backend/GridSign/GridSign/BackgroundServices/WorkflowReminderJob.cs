using GridSign.Helpers;
using GridSign.Models.DTOs.RequestDTO;
using GridSign.Models.Entities;
using GridSign.Repositories.SignWorkFlow.Interfaces;
using GridSign.Services.Interfaces;
using Quartz;

namespace GridSign.BackgroundServices;

public class WorkflowReminderJob(ISignWorkFlowViewRepo viewRepo,ISigningWorkflowService signingWorkflowService) : IJob
{
    public async Task Execute(IJobExecutionContext context)
    {
        var workflowId = int.Parse(context.JobDetail.JobDataMap.GetString("WorkflowId")!);
         Logger.Logg(LoggLevel.Info,$"[Quartz] Running reminder job for workflow {workflowId} at {DateTime.Now}");

        // Fetch workflow details
        var (status,_, workflowDetails) = viewRepo.GetWorkflowRecipientDetials(workflowId);
        if (status.Equals("error") || workflowDetails == null) return;

        // Stop if workflow expired or completed
        if (workflowDetails.ValidUntil < DateOnly.FromDateTime(DateTime.UtcNow) || workflowDetails.Status is WorkflowStatus.Completed or WorkflowStatus.Cancelled or WorkflowStatus.Expired)
        {
            await signingWorkflowService.CancelWorkflowRemindersAsync(workflowId);
            return;
        }

        // Get recipients who have NOT signed yet
        var recipients = viewRepo.GetWorkflowEnvelopes(workflowId).Where(wfEnvelope => wfEnvelope.Status is EnvelopeStatus.InProgress).OrderBy(we => we.WorkflowRecipient.TemplateRecipient!.RecipientRole!.RolePriority);

        foreach (var recipient in recipients)
        {
            await signingWorkflowService.SendReminderToRecipientAsync(recipient.WorkflowRecipient.WorkflowRecipientId);
        }
    }
}
