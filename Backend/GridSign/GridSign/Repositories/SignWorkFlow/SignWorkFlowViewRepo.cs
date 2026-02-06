using GridSign.Data;
using GridSign.Helpers;
using GridSign.Models.DTOs.CommonDTO;
using GridSign.Models.DTOs.RequestDTO;
using GridSign.Models.Entities;
using GridSign.Repositories.RepoHelper;
using GridSign.Repositories.SignWorkFlow.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace GridSign.Repositories.SignWorkFlow;

public class SignWorkFlowViewRepo(ApplicationDbContext dbContext) : RepoUtility(dbContext),ISignWorkFlowViewRepo
{ 
    public (string status, string message, WorkflowRecipient workflowRecipient) GetRecipientDetails(int recipientId)
    {
        var status = "error";
        var message = "An error occurred while fetching the recipient details";
        var wfRecipient = new WorkflowRecipient { WorkflowEnvelope = null };
        try
        {
           wfRecipient = DbContext.WorkflowRecipient
               .Include(wf => wf.WorkflowEnvelope)  
                    .ThenInclude(e => e.Workflow)
               .Include(wf => wf.TemplateRecipient)
                   .ThenInclude(tr => tr!.DefaultUser)
               .Include(wf => wf.User)
               .FirstOrDefault(recipients => recipients.WorkflowRecipientId == recipientId)!;
           status = "success";
           message = "Recipient details retrieved successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message,e);
        }
        return (status, message, wfRecipient);
    }

    public (string status,string message,Workflow workflowDetails) GetWorkFlowBasicDetails(int workflowId)
    {
        var status = "error";
        var message = "An error occurred while fetching the workflow details";
        var wfDetails = new Workflow();
        try
        {
            wfDetails = DbContext.Workflow.FirstOrDefault(wf => wf.WorkFlowId == workflowId)!;
            status = "success";
            message = "Workflow details retrieved successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message,e);
        } 
        return (status, message, wfDetails);
    }

    public int? GetWorkflowId(int recipientId)
    {
        var workflowId = DbContext.WorkflowRecipient
            .Include(wr => wr.WorkflowEnvelope)
            .Where(wr => wr.WorkflowRecipientId == recipientId)
            .Select(wr => (int?)wr.WorkflowEnvelope.WorkflowId)
            .FirstOrDefault();

        return workflowId;
    }


    public List<WorkflowRecipient> GetWorkflowRecipients(int workflowId)
    {
        return DbContext.WorkflowRecipient
            .Where(wr => wr.EnvelopeId == workflowId)
            .Include(wr => wr.User)
            .Include(wr => wr.TemplateRecipient)
                .ThenInclude(tr => tr!.RecipientRole)
            .OrderBy(wr => wr.TemplateRecipient!.RecipientRole!.RolePriority) 
            .ToList();
    }
    
    public List<WorkflowEnvelope> GetWorkflowEnvelopes(int workflowId)
    {
        return DbContext.WorkflowEnvelope
            .Where(wfEnvelope => wfEnvelope.WorkflowId == workflowId)
            .Include(wfEnvelope => wfEnvelope.WorkflowRecipient.User)
            .Include(wfEnvelope => wfEnvelope.WorkflowRecipient.TemplateRecipient!.DefaultUser)
            .Include(we => we.WorkflowRecipient.TemplateRecipient!.RecipientRole!) 
            .ToList();
    }
    
    public bool GetIsSequentialSigningEnabled(int workflowId)
    {
        var isSequential = DbContext.Workflow
            .Where(t => t.WorkFlowId == workflowId)
            .Select(t => t.Template!.IsSequentialSigningEnabled)
            .FirstOrDefault();

        return isSequential;
    }

    public (string status, string message, WorkflowRecipientSignedDocument? recipientSignedDocument) GetWorkflowSignedDocument(int workflowId)
    {
        var status = "error";
        var message = "An error occurred while fetching the Signed document";
        WorkflowRecipientSignedDocument? wfSignedDocument = null;
        try
        {
            wfSignedDocument = DbContext.WorkflowRecipientSignedDocument.FirstOrDefault(wrSignedDocument =>
                    wrSignedDocument.WorkflowId == workflowId);
            status = "success";
            message = "Signed document retrieved successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message, wfSignedDocument);
    }

    public (string vSts, string vStsMsg, int lasVersion) GetLatestSignedDocVersion(int signedDocumentId)
    {
        var status = "error";
        var message = "Error occurred while retrieving latest version";
        var latestVersion = 0;
        try
        {
             latestVersion = DbContext.SignedDocumentVersion
                .Where(dv => dv.SignedDocumentId  == signedDocumentId)
                .OrderByDescending(dv => dv.VersionNumber)
                .Select(dv => dv.VersionNumber)
                .FirstOrDefault();

            status = "success";
            message = "Signed document version retrieved successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return (status, message, latestVersion);
    }

    public (string status, string message, List<Workflow> workflows) GetWorkflows(Guid userId, GetWorkflowsDto request)
    {
        var status = "error";
        var message = "An error occurred while fetching the workflows";
        var workflows = new List<Workflow>();
        try
        {
            var query = DbContext.Workflow
                .Where(w => w.WorkFlowCreator == userId);

            // Search 
            if (!string.IsNullOrWhiteSpace(request.SearchTerm))
            { 
                var search = request.SearchTerm.ToLower();

                query = query.Where(t =>
                    (t.WorkflowName != null && t.WorkflowName.ToLower().Contains(search)) || 
                    (t.User != null && t.User.Fname.ToLower().Contains(search)) 
                );
            }
            
            // Filtering
            if (request.Statuses != null && request.Statuses.Any())
            {
                var today = DateOnly.FromDateTime(DateTime.Today);
                // Treat Expired as either explicit DB status or computed by ValidUntil < today
                if (request.Statuses.Contains(WorkflowStatus.Expired))
                {
                    var statusesWithoutExpired = request.Statuses.Where(s => s != WorkflowStatus.Expired).ToList();
                    query = query.Where(w =>
                        statusesWithoutExpired.Contains(w.Status)
                        || (
                            w.ValidUntil != default
                            && w.ValidUntil < today
                            && w.Status != WorkflowStatus.Completed
                            && w.Status != WorkflowStatus.Cancelled
                        )
                    );
                }
                else
                {
                    // Normal status filter
                    query = query.Where(w => request.Statuses.Contains(w.Status));
                    // Additionally, exclude computed-expired items when Expired isn't requested
                    query = query.Where(w =>
                        !(w.ValidUntil != default
                          && w.ValidUntil < today
                          && w.Status != WorkflowStatus.Completed
                          && w.Status != WorkflowStatus.Cancelled)
                    );
                }
            }

            // Sorting
            query = request.SortBy?.ToLower() switch
            {
                "workflowname"     => request.IsDescending ? query.OrderByDescending(w => w.WorkflowName) : query.OrderBy(w => w.WorkflowName),
                "validuntil"       => request.IsDescending ? query.OrderByDescending(w => w.ValidUntil)   : query.OrderBy(w => w.ValidUntil),
                "status"           => request.IsDescending ? query.OrderByDescending(w => w.Status)       : query.OrderBy(w => w.Status),
                "workflowowner"    => request.IsDescending ? query.OrderByDescending(w => w.User!.Fname)  : query.OrderBy(w => w.User!.Fname),
                "createdon"        => request.IsDescending ? query.OrderByDescending(w => w.CreatedOn)    : query.OrderBy(w => w.CreatedOn),
                "lastupdateddate"  => request.IsDescending ? query.OrderByDescending(w => w.LastUpdatedDate) : query.OrderBy(w => w.LastUpdatedDate),
                _ => request.IsDescending ? query.OrderByDescending(w => w.WorkFlowId) : query.OrderBy(w => w.WorkFlowId)
            };


            query = query.Include(w => w.User)
                .Include(w => w.Template);

            // Pagination 
            workflows = query
                .Skip((request.PageNumber - 1) * request.PageSize)
                .Take(request.PageSize)
                .ToList();
            
            status = "success";
            message = "Workflows retrieved successfully.";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message,workflows);
    }

    public int GetWorkflowsCount(string workflowOwner)
    {
        return DbContext.Workflow.Count(t => t.User!.UserId.ToString() == workflowOwner);
    }


    public (string status, string message, Workflow workflowDetails) GetWorkflowDetails(int workflowId)
    {
        var status = "error";
        var message = "An error occurred while fetching the workflow details";
        var workflowDetails = new Workflow();
        try
        {
            workflowDetails = DbContext.Workflow
                .Where(w => w.WorkFlowId == workflowId)
                // Include Template for workflow-level template metadata (name, description, createdOn, sequential signing)
                .Include(w => w.User)
                .Include(w => w.Template)
                .Include(wf => wf.WorkflowEnvelopes)
                .ThenInclude(wfe => wfe.WorkflowRecipient.RecipientSignatures)!
                .ThenInclude(rs => rs.WorkflowRecipientSignedDocument.SignedDocumentVersions)
                .Include(wf => wf.WorkflowEnvelopes)
                .ThenInclude(wfe => wfe.WorkflowRecipient.TemplateRecipient!.DefaultUser)
                .Include(wf => wf.WorkflowEnvelopes)
                .ThenInclude(wfe => wfe.WorkflowRecipient.TemplateRecipient!.RecipientRole)
                .Include(wf => wf.WorkflowEnvelopes)
                .ThenInclude(wfe => wfe.WorkflowRecipient.User)
                // Ensure TemplateRecipient DefaultUser subgraph for custom identity resolution fallback
                .Include(wf => wf.WorkflowEnvelopes)
                .ThenInclude(wfe => wfe.WorkflowRecipient.TemplateRecipient!.DefaultUser)
                .FirstOrDefault();
            
            status = "success";
            message = "Workflow details retrieved successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message, workflowDetails!);
    }

    public (string status, string message) UpdateWorkflowDetails(Workflow updatedWorkflow)
    {
        var status = "error";
        var message = "An error occurred while updating the workflow details"; 
        try
        {
            DbContext.Workflow.Update(updatedWorkflow);
            DbContext.SaveChanges();
            status = "success";
            message = "Workflow details updated successfully";  
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message);
    }


    public bool IsValidRecipientRole(int roleId)
    {
        var isValidRecipientRoleId = false;
        try
        {
            isValidRecipientRoleId = DbContext.RecipientRole.Any(r => r.RoleId == roleId);
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return  isValidRecipientRoleId;
    }
     
    public (string,string,List<TemplateRecipientRole>) GetRoles()
    {
        List<TemplateRecipientRole> rolesList = [];
        var status = "error";
        var message = "Error occur when roles is empty";
        try
        {
              rolesList=DbContext.RecipientRole.ToList();
              status = "success";
              message = "Retrieved Roles";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return (status,message,rolesList);
    }

    public (string status, string message, Workflow? workflowDetails) GetWorkflowRecipientDetials(int workflowId)
    { 
        var status = "error";
        var message = "Error occur while fetching Workflow Details";
        var workflowDetails = new Workflow();
        try
        {
            workflowDetails = DbContext.Workflow.FirstOrDefault(wf => wf.WorkFlowId == workflowId);
            status = "success";
            message = "Workflow Details Retrieved successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return (status,message,workflowDetails);
    }

    // Fetch envelopes where the specified user is the signing recipient (default or custom) including workflow + requester context.
    public (string status, string message, List<WorkflowEnvelope> envelopes) GetUserSignForms(Guid userId)
    {
        var status = "error";
        var message = "Error occurred while fetching sign forms";
        var envelopes = new List<WorkflowEnvelope>();
        try
        {
            envelopes = DbContext.WorkflowEnvelope
                .Include(e => e.Workflow)!
                    .ThenInclude(w => w.User)
                .Include(e => e.WorkflowRecipient)!
                    .ThenInclude(r => r.TemplateRecipient)!
                        .ThenInclude(tr => tr!.DefaultUser)
                .Include(e => e.WorkflowRecipient)!
                    .ThenInclude(r => r.User)
                .Where(e => e.WorkflowRecipient != null)
                .Where(e => (
                        e.WorkflowRecipient!.UseDefaultUser &&
                        e.WorkflowRecipient.TemplateRecipient!.DefaultUserId.HasValue &&
                        e.WorkflowRecipient.TemplateRecipient.DefaultUserId.Value == userId
                    ) || (
                        !e.WorkflowRecipient.UseDefaultUser &&
                        e.WorkflowRecipient.CustomUser.HasValue &&
                        e.WorkflowRecipient.CustomUser.Value == userId
                    ))
                // Exclude cancelled workflow envelopes in the basic fetch variant as well
                .Where(e => e.Workflow != null && e.Workflow.Status != WorkflowStatus.Cancelled)
                .ToList();
            status = "success";
            message = "Sign forms retrieved successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message, envelopes);
    }

    // Optimized version applying search/date/sort/paging server-side for scalability
    public (string status, string message, List<WorkflowEnvelope> envelopes, int totalPending, int totalSigned, int totalExpired, int totalAll) GetUserSignForms(Guid userId, GetSignFormsRequestDto requestDto)
    {
        var status = "error";
        var message = "Error occurred while fetching sign forms";
        var envelopes = new List<WorkflowEnvelope>();
        int totalPending = 0; int totalSigned = 0; int totalExpired = 0; int totalAll = 0;
        try
        {
            var baseQuery = DbContext.WorkflowEnvelope
                .Include(e => e.Workflow)!
                    .ThenInclude(w => w.User)
                .Include(e => e.WorkflowRecipient)!
                    .ThenInclude(r => r.TemplateRecipient)!
                        .ThenInclude(tr => tr!.DefaultUser)
                .Include(e => e.WorkflowRecipient)!
                    .ThenInclude(r => r.TemplateRecipient)!
                        .ThenInclude(tr => tr!.TemplateRecipientField)!
                            .ThenInclude(f => f.Field)
                .Include(e => e.WorkflowRecipient)!
                    .ThenInclude(r => r.User)
                .Where(e => e.WorkflowRecipient != null)
                .Where(e => (
                        e.WorkflowRecipient!.UseDefaultUser &&
                        e.WorkflowRecipient.TemplateRecipient!.DefaultUserId.HasValue &&
                        e.WorkflowRecipient.TemplateRecipient.DefaultUserId.Value == userId
                    ) || (
                        !e.WorkflowRecipient.UseDefaultUser &&
                        e.WorkflowRecipient.CustomUser.HasValue &&
                        e.WorkflowRecipient.CustomUser.Value == userId
                    ))
                // Exclude envelopes whose parent workflow is Cancelled; cancelled workflows should not surface sign forms
                .Where(e => e.Workflow != null && e.Workflow.Status != WorkflowStatus.Cancelled);

            // Date range filter (SentAt or Workflow.CreatedOn)
            if (!string.IsNullOrWhiteSpace(requestDto.DateRange) && requestDto.DateRange != "all")
            {
                var days = requestDto.DateRange switch { "7d" => 7, "30d" => 30, "90d" => 90, _ => 0 };
                if (days > 0)
                {
                    var threshold = DateTime.Now.AddDays(-days);
                    baseQuery = baseQuery.Where(e => (e.SentAt ?? e.Workflow!.CreatedOn) >= threshold);
                }
            }

            // Search (title or requester)
            if (!string.IsNullOrWhiteSpace(requestDto.SearchTerm))
            {
                var search = requestDto.SearchTerm.ToLower();
                baseQuery = baseQuery.Where(e =>
                    (e.Workflow!.WorkflowName != null && e.Workflow.WorkflowName.ToLower().Contains(search)) ||
                    (e.Workflow.User != null && e.Workflow.User.Fname.ToLower().Contains(search))
                );
            }

            // Materialize for status classification (computed) — could be optimized further with projection
            var materialized = baseQuery.ToList();
            // Compute semantic status
            var classified = materialized.Select(e => {
                var wf = e.Workflow!;
                var now = DateTime.Now;
                var dueExpired = wf.ValidUntil != default && wf.ValidUntil < DateOnly.FromDateTime(now);
                string s = e.Status == EnvelopeStatus.Completed ? "Signed" : (e.Status == EnvelopeStatus.Expired || dueExpired ? "Expired" : "Pending");
                return (Envelope: e, Status: s);
            }).ToList();

            // Status filter
            if (requestDto.Statuses != null && requestDto.Statuses.Any())
                classified = classified.Where(c => requestDto.Statuses.Contains(c.Status)).ToList();

            totalPending = classified.Count(c => c.Status == "Pending");
            totalSigned = classified.Count(c => c.Status == "Signed");
            totalExpired = classified.Count(c => c.Status == "Expired");
            totalAll = classified.Count;

            // Sorting
            var sortKey = requestDto.SortBy?.ToLower();
            Func<(WorkflowEnvelope Envelope, string Status), object?> keySelector = sortKey switch
            {
                "title" => c => c.Envelope.Workflow!.WorkflowName,
                "duedate" => c => c.Envelope.Workflow!.ValidUntil != default ? c.Envelope.Workflow.ValidUntil.ToDateTime(TimeOnly.MinValue) : DateTime.MaxValue,
                "requestedat" => c => c.Envelope.SentAt ?? c.Envelope.Workflow!.CreatedOn,
                _ => c => c.Envelope.SentAt ?? c.Envelope.Workflow!.CreatedOn
            };
            classified = requestDto.IsDescending ? classified.OrderByDescending(keySelector).ToList() : classified.OrderBy(keySelector).ToList();

            envelopes = classified
                .Skip((requestDto.PageNumber - 1) * requestDto.PageSize)
                .Take(requestDto.PageSize)
                .Select(c => c.Envelope)
                .ToList();

            status = "success";
            message = "Sign forms retrieved successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message, envelopes, totalPending, totalSigned, totalExpired, totalAll);
    }

    public (string status, string message, WorkflowEnvelope? envelope) GetEnvelopeById(int envelopeId)
    {
        var status = "error"; var message = "Failed to fetch envelope"; WorkflowEnvelope? env = null;
        try
        {
            env = DbContext.WorkflowEnvelope
                .Include(e => e.Workflow)!
                    .ThenInclude(w => w.User)
                .Include(e => e.WorkflowRecipient)!
                    .ThenInclude(r => r.TemplateRecipient)!
                        .ThenInclude(tr => tr!.DefaultUser)
                // Eager load recipient field links and the underlying Field definitions
                .Include(e => e.WorkflowRecipient)!
                    .ThenInclude(r => r.TemplateRecipient)!
                        .ThenInclude(tr => tr!.TemplateRecipientField)!
                            .ThenInclude(trf => trf.Field)
                .Include(e => e.WorkflowRecipient)!
                    .ThenInclude(r => r.User)
                .FirstOrDefault(e => e.WorkflowEnvelopeId == envelopeId);
            status = "success"; message = "Envelope retrieved";
        }
        catch (Exception ex)
        {
            Logger.Logg(LoggLevel.Error, ex.Message, ex);
        }
        return (status, message, env);
    }
}