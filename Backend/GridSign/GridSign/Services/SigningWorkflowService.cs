using AutoMapper;
using GridSign.BackgroundServices;
using GridSign.BackgroundServices.Interfaces; 
using GridSign.Helpers;
using GridSign.Models.DTOs.CommonDTO;
using GridSign.Models.DTOs.RequestDTO;
using GridSign.Models.DTOs.ResponseDTO;
using GridSign.Models.Entities;
using GridSign.Repositories.SigningToken.Interfaces;
using GridSign.Repositories.SignWorkFlow.Interfaces;
using GridSign.Repositories.Templates.Interfaces; 
using GridSign.Services.Interfaces; 
using GridSign.Services.ServiceHelper;
using GridSign.Services.ServiceHelper.Interfaces;
using Quartz;

namespace GridSign.Services;

/// <summary>
/// Handles all workflow-related signing operations, including creation, signing, 
/// recipient management, scheduling reminders, and background task orchestration.
/// </summary>
/// <remarks>
/// This service is responsible for managing the entire lifecycle of a signing workflow:
/// - Creating workflows and templates
/// - Managing recipients and envelopes
/// - Handling signing actions
/// - Scheduling and cancelling Quartz-based reminders
/// - Coordinating background jobs for sequential/parallel signing flows.
/// </remarks>

public class SigningWorkflowService(ISignWorkFlowUpdateRepo updateRepo,
    ISignWorkFlowViewRepo viewRepo,
    IBackgroundTaskQueue backgroundQueue,
    IServiceProvider serviceProvider,
    IUserContext curUser,
    IUserService userService,
    ISchedulerFactory schedulerFactory,
    ITemplateService templateService,
    ITemplateViewRepo templateViewRepo,
    IMapper autoMapper,
    ISigningTokenRepository signingTokenRepo) : ServiceUtility,ISigningWorkflowService
{
    // Starts a draft workflow by updating status and enqueuing background tasks; optionally schedules reminders
    public async Task<ApiResponse<object>> StartWorkflowAsync(int workflowId, bool? autoReminder = null, int? reminderIntervalDays = null)
    {
        var response = new ApiResponse<object>();
        try
        {
            // Guard: ensure workflow exists and is in Draft status
            var (_, _, wf) = viewRepo.GetWorkFlowBasicDetails(workflowId);
            if (wf == null || wf.WorkFlowId == 0)
                throw new Exception("Workflow not found");
            if (wf.Status != WorkflowStatus.Draft)
                throw new Exception("Only draft workflows can be started.");

            var (isSuccess, transaction) = updateRepo.BeginTransaction();
            if (!isSuccess)
                throw new Exception("Transaction failed");
            await using (transaction)
            {
                var (sts, msg) = updateRepo.ToggleWorkflowCompletedStatus(workflowId, WorkflowStatus.InProgress);
                if (sts == "error") throw new Exception(msg);
                // enqueue processing
                EnqueueSigningWorkflow(workflowId);
                // Schedule reminders if requested (prefer payload flags; fallback to existing DB values)
                var shouldReminder = autoReminder ?? (wf.ReminderIntervalInDays > 0);
                var interval = reminderIntervalDays ?? (wf.ReminderIntervalInDays > 0 ? wf.ReminderIntervalInDays : 0);
                if (shouldReminder && interval > 0 && wf.ValidUntil != default)
                {
                    var remainingDays = (wf.ValidUntil.ToDateTime(TimeOnly.MinValue) - DateTime.Now).Days;
                    var repeatCount = Math.Max(0, remainingDays - 1);
                    if (repeatCount > 0)
                        await ScheduleWorkflowReminders(workflowId, interval, repeatCount);
                }
                await transaction.CommitAsync();
            }
            response.Status = "success";
            response.Message = "Workflow started";
        }
        catch (Exception e)
        {
            response.Status = "error";
            response.Message = e.Message;
        }
        return response;
    }

    // Cancels an active/in-progress workflow and cancels reminders; persist reason
    public async Task<ApiResponse<object>> CancelWorkflowAsync(int workflowId, string? reason)
    {
        var response = new ApiResponse<object>();
        try
        {
            var (_, _, wf) = viewRepo.GetWorkFlowBasicDetails(workflowId);
            if (wf == null || wf.WorkFlowId == 0)
                throw new Exception("Workflow not found");
            if (wf.Status == WorkflowStatus.Completed || wf.Status == WorkflowStatus.Cancelled)
                throw new Exception("Cannot cancel a completed or already cancelled workflow.");
            var (isSuccess, transaction) = updateRepo.BeginTransaction();
            if (!isSuccess)
                throw new Exception("Transaction failed");
            await using (transaction)
            {
                var (sts, msg) = updateRepo.ToggleWorkflowCompletedStatus(workflowId, WorkflowStatus.Cancelled);
                // Reason can be persisted via future audit log implementation
                if (sts == "error") throw new Exception(msg);
                // Update timestamp only after cancellation
                wf.LastUpdatedDate = DateTime.Now;
                var (updSts, updMsg) = updateRepo.UpdateWorkflowDetails(wf);
                if (updSts == "error") throw new Exception(updMsg);
                await CancelWorkflowRemindersAsync(workflowId);
                await transaction.CommitAsync();
            }
            response.Status = "success";
            response.Message = "Workflow cancelled";
        }
        catch (Exception e)
        {
            response.Status = "error";
            response.Message = e.Message;
        }
        return response;
    }

    // Deletes a workflow if it is Draft, Completed, or Cancelled (not allowed when InProgress or Expired)
    public async Task<ApiResponse<object>> DeleteWorkflowAsync(int workflowId)
    {
        var response = new ApiResponse<object>();
        try
        {
            var (_, _, wf) = viewRepo.GetWorkFlowBasicDetails(workflowId);
            if (wf == null || wf.WorkFlowId == 0)
                throw new Exception("Workflow not found");
            switch (wf.Status)
            {
                case WorkflowStatus.InProgress:
                    throw new Exception("Cannot delete an in-progress workflow.");
                case WorkflowStatus.Expired:
                    throw new Exception("Cannot delete an expired workflow.");
            }

            var (isSuccess, transaction) = updateRepo.BeginTransaction();
            if (!isSuccess) throw new Exception("Transaction failed");
            await using (transaction)
            {
                var (delSts, delMsg) = updateRepo.DeleteWorkflow(workflowId);
                if (delSts == "error") throw new Exception(delMsg);
                await CancelWorkflowRemindersAsync(workflowId);
                await transaction.CommitAsync();
            }
            response.Status = "success"; response.Message = "Workflow deleted"; response.Data = new { WorkflowId = workflowId };
        }
        catch (Exception e)
        {
            response.Status = "error"; response.Message = e.Message;
        }
        return response;
    }
    // Creates a new signing workflow and optionally creates a new template if required
    public async Task<ApiResponse<object>> CreateWorkFlow(CreateWorkFlowDto workflowDto, IFormFile document)
    {
        var apiResponse = new ApiResponse<object>(); 
        try
        {
            var (isSuccess, transaction) = updateRepo.BeginTransaction();
            if (!isSuccess)
                throw new Exception("Transaction failed");

            await using (transaction)
            {
                try
                {
                    var workflowCreator = curUser.GetCurrentUser();
                    if (workflowCreator == null)
                        throw new Exception("User is not logged in..");

                    var templateId = workflowDto.TemplateId;

                    //If the workflow is created with template then use existing templateId or create a new Template.
                    if (workflowDto.RecipientConfiguration == RecipientConfiguration.CreateNewTemplate)
                    {
                        var createTemplateDto = autoMapper.Map<CreateTemplateDto>(workflowDto);
                        var (createTemplateStatus, createTemplateStsMsg, tId) =
                            await templateService.CreateTemplate(workflowCreator.UserId!, createTemplateDto, document);
                        if (createTemplateStatus.Equals("error"))
                            throw new Exception(createTemplateStsMsg);
                        templateId = tId;
                    }

                    if (templateId is null)
                        throw new Exception("Exception occurred!! Cannot create Template...");

                    // Create Workflow
                    var workflow = new Workflow
                    {
                        WorkflowName = workflowDto.DocumentName, TemplateId = templateId.Value,
                        WorkFlowCreator = new Guid(workflowCreator.UserId!), Status = workflowDto.StartImmediately ? WorkflowStatus.InProgress : WorkflowStatus.Draft,
                        ValidUntil = workflowDto.ValidTill, ReminderIntervalInDays = workflowDto.ReminderIntervalDays,
                        RecipientConfiguration = workflowDto.RecipientConfiguration, CreatedOn = DateTime.Now,
                        LastUpdatedDate = DateTime.Now
                    };
                    var (wfSts, wfMsg) = updateRepo.CreateNewWorkflow(workflow);
                    if (wfSts.Equals("error"))
                        throw new Exception(wfMsg);

                    //Create WorkflowRecipients
                    CreateWorkflowRecipientsWithEnvelope(workflowDto.Recipients, workflow.WorkFlowId, templateId.Value,
                        workflowDto.RecipientConfiguration);

                    await transaction.CommitAsync();
                    apiResponse.Message = "Workflow Created Successfully";
                    apiResponse.Status = "success";

                    if (workflowDto.StartImmediately)
                    {
                        // Start workflow background process
                        EnqueueSigningWorkflow(workflow.WorkFlowId);

                        if (workflowDto.AutoRemainder)
                        {
                            // Schedule reminders for workflow recipients
                            var remainderInterval = workflowDto.ReminderIntervalDays;
                            var rCount = (workflowDto.ValidTill.ToDateTime(TimeOnly.MinValue) - DateTime.Now).Days;
                            var repeatCount = Math.Max(0, rCount - 1);
                            if (repeatCount > 0 && remainderInterval > 0)
                                await ScheduleWorkflowReminders(workflow.WorkFlowId, remainderInterval, repeatCount);
                        }
                    }
                }
                catch (Exception e)
                {
                    Logger.Logg(LoggLevel.Error, e.Message, e);
                    await transaction.RollbackAsync();
                    apiResponse.Message = e.Message;
                }
            }
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }

        return apiResponse;
    }
    
    // Creates workflow recipients and their associated envelopes.
    private void CreateWorkflowRecipientsWithEnvelope(List<RecipientDto>? workflowDtoRecipients, int workflowId, int templateId, RecipientConfiguration recipientConfiguration)
    {  
        var wfRecipientList = new List<WorkflowRecipient>();
        IEnumerable<(int TemplateRecipientId, bool UseDefaultUser, Guid? CustomUser)> recipientData;
       
        if (recipientConfiguration is RecipientConfiguration.CreateNewTemplate or RecipientConfiguration.FromTemplate)
        {
            //Create new template OR use recipients directly from existing template
            var (trStatus,trStsMsg,templateRecipients) = templateViewRepo.GetTemplateRecipientsList(templateId);
            if(trStatus.Equals("error"))
                throw new Exception($"Template recipients fetch failed: {trStsMsg}");

            recipientData = templateRecipients.Select(r => (r.TemplateRecipientId, true, (Guid?)null));
        }
        else
        {
            // Custom or Mixed — recipients come from DTO
            if (workflowDtoRecipients is null || workflowDtoRecipients.Count == 0)
                throw new ArgumentException("Recipients list cannot be empty for Custom or Mixed configuration.");
            
            recipientData = workflowDtoRecipients.Select(dto =>
            {
                if (!dto.TemplateRecipientId.HasValue)
                    throw new ArgumentException("Each recipient must include TemplateRecipientId.");

                Guid? customUserId = null;
                if (dto.UseDefaultUser) 
                    return (dto.TemplateRecipientId.Value, dto.UseDefaultUser, customUserId);
                
                var user = userService.GetOrCreateUser(dto.Email!, dto.Name!);
                customUserId = user.UserId;

                return (dto.TemplateRecipientId.Value, dto.UseDefaultUser, customUserId);
            });
        }
        
        // Create WorkflowEnvelope and WorkflowRecipient for each recipient
        wfRecipientList.AddRange(recipientData.Select(data =>
        {
            var workflowEnvelope = new WorkflowEnvelope
            {
                WorkflowId = workflowId,
                Status = EnvelopeStatus.Draft
            };

            return new WorkflowRecipient
            {
                TemplateRecipientId = data.TemplateRecipientId,
                UseDefaultUser = data.UseDefaultUser,
                CustomUser = data.CustomUser,
                WorkflowEnvelope = workflowEnvelope
            };
        }));

        var (wrSts, wrStsMsg) = updateRepo.CreateWorkflowRecipientsWithEnvelopes(wfRecipientList);
        if(wrSts.Equals("error"))
            throw new Exception($"Template recipients fetch failed: {wrStsMsg}");
    }
    
    // Enqueues the signing workflow process in the background queue for asynchronous execution.
    private void EnqueueSigningWorkflow(int workflowId)
    {
        backgroundQueue.QueueBackgroundWorkItem(async _ =>
        { 
            var signingService = serviceProvider.CreateScope().ServiceProvider.GetRequiredService<ISigningWorkflowService>();
            await signingService.HandleSigningWorkflowAsync(workflowId);
        });
    }
    
    // Handles the execution of the signing workflow process — sending signing emails and updating envelope statuses.
    public async Task HandleSigningWorkflowAsync(int workflowId)
    {
        try
        {
            var attemptedRecipients = new HashSet<int> (); 
             
            // Get WorkflowEnvelopes
            var workflowEnvelopes = viewRepo.GetWorkflowEnvelopes(workflowId); 
            if(workflowEnvelopes.Count < 0)
                throw new Exception("No workflow envelopes found.");
            
            // Get the signing mode from the template (true = sequential signing, false = parallel signing)
            var isSequentialSigningEnabled = viewRepo.GetIsSequentialSigningEnabled(workflowId);
 
            // Iterate through all workflow recipient envelopes whose envelopes have not yet been issued from the workflow
            foreach (var recipientEnvelope in workflowEnvelopes.Where(wfEnvelope => wfEnvelope.Status is EnvelopeStatus.Draft).OrderBy(we => we.WorkflowRecipient!.TemplateRecipient!.RecipientRole!.RolePriority))
            {
                var recipient = recipientEnvelope.WorkflowRecipient;
                if (attemptedRecipients.Contains(recipient!.WorkflowRecipientId))
                    continue;
                
                var recipientUserDetails = recipient.UseDefaultUser ? recipient.TemplateRecipient!.DefaultUser : recipient.User;
                if (recipientUserDetails == null) continue;

                // Create a one-time signing token (valid 60 minutes) and compose HTML email
                var (tokStatus, tokMsg, signToken) = signingTokenRepo.CreateToken(recipient.WorkflowRecipientId, TimeSpan.FromMinutes(60));
                if (!tokStatus.Equals("success") || string.IsNullOrWhiteSpace(signToken))
                {
                    Logger.Logg(LoggLevel.Error, $"Workflow {workflowId}: Failed to create signing token for recipient {recipient.WorkflowRecipientId}: {tokMsg}");
                    continue; // skip sending email
                }

                var frontendBase = Environment.GetEnvironmentVariable("FRONTEND_BASE_URL") ?? "http://localhost:3000";
                // Include envelope id in signing URL so the frontend can load correct envelope context.
                var signLink = $"{frontendBase.TrimEnd('/')}/sign/{recipientEnvelope.WorkflowEnvelopeId}?recipientId={recipient.WorkflowRecipientId}&token={signToken}";
                var emailHtml = $@"<!DOCTYPE html><html><head><meta charset='UTF-8'/><meta name='viewport' content='width=device-width,initial-scale=1'/><title>Signature Requested</title></head><body style='margin:0;padding:0;background:#f5f7fa;font-family:Arial,sans-serif;'>
    <table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='background:#f5f7fa;'>
        <tr><td align='center' style='padding:28px;'>
            <table role='presentation' width='640' style='max-width:640px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);'>
                <tr><td style='background:#1F4167;color:#ffffff;padding:22px 32px;font-size:20px;font-weight:600;'>Document Signature Requested</td></tr>
                <tr><td style='padding:0;'>
                    <a href='{signLink}' style='display:block;text-decoration:none;background-image:url(https://static.vecteezy.com/system/resources/previews/049/887/312/non_2x/email-verification-concept-receiving-incoming-email-sending-and-receiving-verification-email-can-be-used-for-web-page-banner-mobile-app-flat-illustration-isolated-on-background-vector.jpg);background-size:cover;background-position:center;height:260px;'>
                        <table role='presentation' width='100%' height='260'><tr><td align='center'>
                            <span style='display:inline-block;padding:14px 34px;background:#ffb400;color:#1F4167;font-weight:700;border-radius:30px;font-size:16px;letter-spacing:.5px;box-shadow:0 3px 8px rgba(0,0,0,0.25);'>SIGN DOCUMENT</span>
                        </td></tr></table>
                    </a>
                </td></tr>
                <tr><td style='padding:30px 42px;font-size:15px;line-height:22px;color:#333;'>
                    You have been requested to sign a document on GridSign. Click the button below to review and sign.<br/><br/>
                    <div style='text-align:center;margin:16px 0;'>
                        <a href='{signLink}' style='display:inline-block;padding:12px 28px;background:#1F4167;color:#ffffff;text-decoration:none;font-weight:600;border-radius:6px;font-size:14px;'>Open & Sign</a>
                    </div>
                    This link expires in 60 minutes. For security, it can only be used once.<br/><br/>
                    If you did not expect this email, you can ignore it.
                </td></tr>
                <tr><td style='padding:20px 32px;background:#f0f4f8;font-size:12px;color:#65748b;text-align:center;'>
                    &copy; {DateTime.UtcNow.Year} GridSign. If the button doesn't work, copy this URL:<br/><span style='word-break:break-all;color:#1F4167'>{signLink}</span>
                </td></tr>
            </table>
        </td></tr>
    </table>
</body></html>";
                var (mailStatus, _) = await SendEmailAsync(recipientUserDetails.Email, "Signature Required", emailHtml);
                var status = mailStatus == "success" ? EnvelopeStatus.InProgress : EnvelopeStatus.Failed;
                
                //Change the envelope status whether it is sent or failed.
                var (envSts,envStsMsg) = updateRepo.ChangeRecipientEnvelopeStatus(recipient.WorkflowRecipientId,status);
                if(envSts.Equals("error"))
                    Logger.Logg(LoggLevel.Error, $"Workflow {workflowId}: Failed to update envelope status for recipient {recipient.WorkflowRecipientId} (EnvelopeId: {recipientEnvelope.WorkflowEnvelopeId}). Error: {envStsMsg}");
                
                //if the current recipient needs to sign then it stops sending mails to the next recipient
                if (mailStatus == "success" && isSequentialSigningEnabled && recipient.TemplateRecipient!.DeliveryType == DeliveryType.NeedsToSign) break;

                attemptedRecipients.Add(recipient.WorkflowRecipientId); 
            }

            //if the all the recipients had signed then the workflow status has been changed to completed
            if (workflowEnvelopes.All(wfEnvelope => wfEnvelope.Status is EnvelopeStatus.Completed))
            {
                Logger.Logg(LoggLevel.Info, $"Workflow {workflowId}: All recipients signed. Attempting completion...");
                var (status, message) = updateRepo.ToggleWorkflowCompletedStatus(workflowId, WorkflowStatus.Completed);
                if (string.Equals(status, "success")) {
                    await CancelWorkflowRemindersAsync(workflowId);
                    Logger.Logg(LoggLevel.Info, $"Workflow {workflowId}: Completed successfully. Reminders cancelled.");
                }
                else {
                    Logger.Logg(LoggLevel.Error, $"Workflow {workflowId}: Failed to mark as completed. Error: {message}");
                }
            }
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
    }
    
    // Marks a recipient’s document as signed, creates proof and version entries, and triggers next recipient.
    public async Task<ApiResponse<object>> CompleteDocumentSigningAsync(CompleteSigningReqDto signingReqDto, IFormFile signedDoc, IFormFile? proofImage = null)
    {
        var apiResponse = new ApiResponse<object>();
        try
        { 
            var (isSuccess,transaction) = updateRepo.BeginTransaction();
            if (!isSuccess)
                throw new Exception("Transaction failed");

            await using (transaction)
            {
                try
                {
                    var recipientId = signingReqDto.RecipientId;
                    var token = signingReqDto.Token;
                    
                    //Get workflow ID
                    var workflowId = viewRepo.GetWorkflowId(recipientId);
                    if(workflowId is null)
                        throw new Exception("Workflow id not found");
 
                    //Get the recipient details from workflow Recipients
                    var (wrSts,wrStsMsg,recipient) = viewRepo.GetRecipientDetails(recipientId); 
                    if(wrSts.Equals("error"))
                        throw new Exception(wrStsMsg);
                    
                    //Get the Workflow details 
                    var (wfSts,wfStsMsg,workFlowDetails) = viewRepo.GetWorkFlowBasicDetails(workflowId.Value); 
                    if(wfSts.Equals("error"))
                        throw new Exception(wfStsMsg);
                    
                    // Check if the workflow validity period has expired.
                    // If expired, the recipient should not be allowed to sign the document.
                    if (workFlowDetails.ValidUntil < DateOnly.FromDateTime(DateTime.Now))
                    {
                        //Change the envelope status as expired.
                        var (envSts,envStsMsg) = updateRepo.ChangeRecipientEnvelopeStatus(recipient.EnvelopeId, EnvelopeStatus.Expired);
                        if(envSts.Equals("error"))
                            Logger.Logg(LoggLevel.Error, $"Workflow {workflowId}: Failed to update envelope status for recipient {recipient.WorkflowRecipientId}, Workflow Envelope Expired (EnvelopeId: {recipient.EnvelopeId}). Error: {envStsMsg}");

                        throw new Exception("This document is no longer valid for signing.");
                    }
                    
                    // Check if the recipient already signed for this envelope (avoid duplicate signing operations)
                    if (recipient.WorkflowEnvelope != null && recipient.WorkflowEnvelope.Status == EnvelopeStatus.Completed)
                    {
                        apiResponse.Status = "info";
                        apiResponse.Message = "Document already signed!";
                        await transaction.RollbackAsync(); // No changes needed
                        return apiResponse;
                    }

                    var currentUserDetails = recipient.UseDefaultUser ? recipient.TemplateRecipient!.DefaultUser : recipient.User;
                    if(currentUserDetails == null)
                        throw new Exception("User details not found.");

                    // Validate signing token
                    if (string.IsNullOrWhiteSpace(token))
                        throw new Exception("Missing signing token");
                    var signingRecord = signingTokenRepo.GetValidToken(token);
                    if (signingRecord == null || signingRecord.WorkflowRecipientId != recipient.WorkflowRecipientId)
                        throw new Exception("Invalid or expired signing token");
                     
                    //Add the signed document
                    var (sdSts,sdStsMsg, signedDocument) = await CreateRecipientSignedDocument(currentUserDetails,signedDoc, workflowId.Value);
                    if(sdSts.Equals("error"))
                        throw new Exception(sdStsMsg);
                    
                    if(signedDocument == null)
                        throw new Exception("Error Occurred..Signed Document could not be created.");
                        
                    //Create a New Recipient Signature With the signedDocument
                    var recipientSignature = new WorkflowRecipientSignature { WorkflowRecipientId = recipient.WorkflowRecipientId, RecipientSignedDocumentId = signedDocument.SignedDocumentId ,SignedAt = DateTime.Now, IsSigned = true , WorkflowRecipientSignedDocument = signedDocument}; 
                    var (singingStatus, signingMessage) = updateRepo.CreateNewWorkflowRecipientSignature(recipientSignature);
                    if (singingStatus.Equals("error"))
                        throw new Exception(signingMessage);

                    if (proofImage is not null)
                    {
                        //Create a FileSource for the Recipient Proof
                        var recipientProof = await ConvertDocToBytes(proofImage);
                        var (proofSts, proofMsg, proofResourceId) = updateRepo.AddFileResource(recipientProof,
                            "documentName", FileResourceType.ProofDoc, currentUserDetails.UserId.ToString());
                        if (proofSts.Equals("error"))
                            throw new Exception(proofMsg);

                        //Add the Recipient Proof to the Recipient Signature
                        var (proofLinkSts, proofLinkMsg) =
                            updateRepo.AddProofToRecipientSignature(recipientSignature.RecipientSignatureId,
                                proofResourceId);
                        if (proofLinkSts.Equals("error"))
                            throw new Exception(proofLinkMsg);
                    }

                    var (eSts,eStsMsg) = updateRepo.ChangeRecipientEnvelopeStatus(recipient.EnvelopeId, EnvelopeStatus.Completed);
                    if (eSts.Equals("error")) {
                        Logger.Logg(LoggLevel.Error,
                            $"Workflow {workflowId}: Failed to update envelope status for recipient {recipient.WorkflowRecipientId}, Workflow Envelope has been Completed (EnvelopeId: {recipient.EnvelopeId}). Error: {eStsMsg}");
                        throw new Exception("Error Occurred..Could not Sign the document right now!..Pls try again after sometime.");
                    }
                    
                    //Workflow has been updated
                    var (sts,stsMsg) = updateRepo.UpdateWorkflowLastUpdatedTime(workflowId.Value, DateTime.Now);
                    if (sts.Equals("error"))
                        Logger.Logg(LoggLevel.Error,stsMsg);

                    apiResponse.Status = "success";
                    apiResponse.Message = "Document Signed Successfully";
                    await transaction.CommitAsync();
                    // Invalidate token after commit
                    var _ = signingTokenRepo.MarkUsed(signingRecord.SigningTokenId);
                     
                    //Handle the other recipients if available using a background service 
                    EnqueueSigningWorkflow( workflowId.Value);
                }
                catch (Exception e)
                {
                    Logger.Logg(LoggLevel.Error, e.Message, e);
                    await transaction.RollbackAsync();
                    apiResponse.Message = e.Message;
                }
            }
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return apiResponse;
    }

    // Creates and links a signed document for a recipient, handling versioning for sequential workflows.
    private async Task<(string status,string message, WorkflowRecipientSignedDocument? wfSignedDocument)> CreateRecipientSignedDocument(Users currentUserDetails, IFormFile signedDoc,int workflowId)
    {
        var status = "error";
        var message = "Error occured while creating the recipient signed document.";
        WorkflowRecipientSignedDocument? wfSignedDocument = null;
        try
        {
            // Get the signing mode from the template (true = sequential signing, false = parallel signing)
            var isSequentialSigningEnabled = viewRepo.GetIsSequentialSigningEnabled(workflowId);
            
            var documentName = $"{currentUserDetails.Fname}_SignedDoc";  
            var signedDocument= await ConvertDocToBytes(signedDoc);
            var latestDocVersion = 1;
                    
            //Create a FileSource for the signed document 
            var (frSts, frMsg, resourceId) = updateRepo.AddFileResource(signedDocument,documentName, FileResourceType.SignedDoc,currentUserDetails.UserId.ToString());
            if(frSts.Equals("error"))
                throw new Exception(frMsg); 
            
            // For sequential signing — try to reuse existing signed document
            if (isSequentialSigningEnabled)
            {
                var (getStatus, getMsg, existingDoc) = viewRepo.GetWorkflowSignedDocument(workflowId);
                if (getStatus.Equals("error"))
                    throw new Exception(getMsg);

                if (existingDoc != null)
                { 
                    //Add new version of the signed document
                    var (vSts, vStsMsg, lastVersion) = viewRepo.GetLatestSignedDocVersion(existingDoc.SignedDocumentId);
                    if(vSts.Equals("error"))
                        throw new Exception(vStsMsg);
                    
                    latestDocVersion = lastVersion + 1;
                }
                wfSignedDocument = existingDoc;
            }
            
            // If not sequential, or if no existing document was found, create a new one
            if (wfSignedDocument == null)
            {
                var workflowSignedDocument = new WorkflowRecipientSignedDocument { WorkflowId = workflowId, IsSharedDocument = isSequentialSigningEnabled};
                var (createStatus, createMsg) = updateRepo.CreateWorkflowSignedDocument(workflowSignedDocument);
                if (createStatus.Equals("error"))
                    throw new Exception(createMsg);

                wfSignedDocument = workflowSignedDocument;
            }

            //Create New SignedDocumentVersion(Add the latest version to the list of documents)
            CreateNewSignedDocumentVersion(resourceId,  wfSignedDocument.SignedDocumentId, latestDocVersion , DateTime.Now);
            
            status = "success";
            message = "Recipient Signed Document created successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }

        return (status, message, wfSignedDocument);
    }

    private SignedDocumentVersion CreateNewSignedDocumentVersion(int resourceId,int signedDocumentId,int latestVersion,DateTime createdAt)
    {
        var newVersion = new SignedDocumentVersion {FileResourceId = resourceId,SignedDocumentId = signedDocumentId, VersionNumber = latestVersion,CreatedAt = createdAt};
        var (updateSts, stsMsg) = updateRepo.CreateNewSignedDocumentVersion(newVersion);
        return updateSts.Equals("error") ? throw new Exception(stsMsg) : newVersion;
    }
    
    // Schedules Quartz-based recurring reminders for a workflow.
    private async Task ScheduleWorkflowReminders(int workflowId, int intervalDays, int repeatCount)
    {
        var scheduler = await schedulerFactory.GetScheduler();
        var jobKey = new JobKey($"reminder-workflow-{workflowId}");

        // Check if job already exists
        if (await scheduler.CheckExists(jobKey))
            return; // Skip scheduling if it already exists

        //create a new job with the workflowId 
        var job = JobBuilder.Create<WorkflowReminderJob>()
            .WithIdentity(jobKey)
            .UsingJobData("WorkflowId", workflowId.ToString())
            .Build();

        //create a new trigger for the automation with interval time and repeat count
        var trigger = TriggerBuilder.Create()
            .WithIdentity($"trigger-workflow-{workflowId}")
            //.StartNow() // start immediately
            .StartAt(DateTime.UtcNow.AddDays(intervalDays)) 
            .WithSimpleSchedule(x => x
               .WithIntervalInHours(intervalDays * 24)  
               //.WithIntervalInSeconds(30)  // 30 seconds interval
               .WithRepeatCount(repeatCount))
            .Build();

        //schedule a background remainder with the above job and trigger configs
        await scheduler.ScheduleJob(job, trigger);
    }
    
    // Cancels any scheduled Quartz reminders for a completed or expired workflow.
    public async Task CancelWorkflowRemindersAsync(int workflowId)
    {
        var scheduler = await schedulerFactory.GetScheduler();
        var jobKey = new JobKey($"reminder-workflow-{workflowId}");
        if (await scheduler.CheckExists(jobKey))
        {
            await scheduler.DeleteJob(jobKey);
        }
    }

    // Sends a reminder email to a specific recipient (reuses existing active signing token).
    public async Task SendReminderToRecipientAsync(int recipientId)
    {
        try
        {
            var (status, message, signerDetails) = viewRepo.GetRecipientDetails(recipientId);
            if(status.Equals("error"))
                throw new Exception(message);

            var currentUserDetails = signerDetails.UseDefaultUser ? signerDetails.TemplateRecipient!.DefaultUser : signerDetails.User;
            if(currentUserDetails == null)
                throw new Exception("User details not found.");

            // Reuse existing active token; if none create a fresh one (same TTL as original 60m from now)
            var (tokStatus, tokMsg, token) = signingTokenRepo.GetOrReuseToken(recipientId, TimeSpan.FromMinutes(60));
            if (!tokStatus.Equals("success") || string.IsNullOrWhiteSpace(token))
            {
                Logger.Logg(LoggLevel.Error, $"Reminder token failure for recipient {recipientId}: {tokMsg}");
                return; // skip sending email
            }

            var frontendBase = Environment.GetEnvironmentVariable("FRONTEND_BASE_URL") ?? "http://localhost:3000";
            var envelopeId = signerDetails.WorkflowEnvelope?.WorkflowEnvelopeId ?? 0;
            var signLink = $"{frontendBase.TrimEnd('/')}/sign/{envelopeId}?recipientId={recipientId}&token={token}";

           var emailHtml = @"<!DOCTYPE html><html><head><meta charset='UTF-8'/><meta name='viewport' content='width=device-width,initial-scale=1'/><title>Signature Reminder</title></head><body style='margin:0;padding:0;background:#f5f7fa;font-family:Arial,sans-serif;'><table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='background:#f5f7fa;'><tr><td align='center' style='padding:28px;'><table role='presentation' width='640' style='max-width:640px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);'><tr><td style='background:#1F4167;color:#ffffff;padding:20px 30px;font-size:18px;font-weight:600;'>Signature Reminder</td></tr><tr><td style='padding:0;'><a href='" + signLink + @"' style='display:block;text-decoration:none;background-image:url(https://static.vecteezy.com/system/resources/previews/049/887/312/non_2x/email-verification-concept-receiving-incoming-email-sending-and-receiving-verification-email-can-be-used-for-web-page-banner-mobile-app-flat-illustration-isolated-on-background-vector.jpg);background-size:cover;background-position:center;height:200px;'><table role='presentation' width='100%' height='200'><tr><td align='center'><span style='display:inline-block;padding:12px 30px;background:#ffb400;color:#1F4167;font-weight:700;border-radius:30px;font-size:15px;letter-spacing:.5px;box-shadow:0 3px 8px rgba(0,0,0,0.25);'>REVIEW & SIGN</span></td></tr></table></a></td></tr><tr><td style='padding:26px 40px;font-size:14px;line-height:22px;color:#333;'>This is a friendly reminder to sign the pending document on GridSign.<br/><br/><div style='text-align:center;margin:16px 0;'><a href='" + signLink + @"' style='display:inline-block;padding:11px 26px;background:#1F4167;color:#ffffff;text-decoration:none;font-weight:600;border-radius:6px;font-size:13px;'>Open & Sign Now</a></div>For security this link uses the same one-time token previously issued. If you already signed, you can ignore this reminder.<br/><br/>If the button above does not work, copy this URL:<br/><span style='word-break:break-all;color:#1F4167;font-size:12px'>" + signLink + @"</span></td></tr><tr><td style='padding:18px 30px;background:#f0f4f8;font-size:12px;color:#65748b;text-align:center;'>&copy; " + DateTime.UtcNow.Year + @" GridSign.</td></tr></table></td></tr></table></body></html>";
            var (mailStatus, stsMsg) = await SendEmailAsync(currentUserDetails.Email, "Signature Reminder", emailHtml);
            if(mailStatus.Equals("error"))
                Logger.Logg(LoggLevel.Error, $"Error sending reminder email to recipient {recipientId}: {stsMsg}");
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
    }

    // Sends reminders to all pending recipients of an active workflow (bulk "Remind Now" operation)
    public async Task<ApiResponse<object>> RemindWorkflowAsync(int workflowId)
    {
        var response = new ApiResponse<object>();
        try
        {
            var (sts, msg, wfBasic) = viewRepo.GetWorkFlowBasicDetails(workflowId);
            if (sts == "error") throw new Exception(msg);
            if (wfBasic == null) throw new Exception("Workflow not found");
            switch (wfBasic.Status)
            {
                case WorkflowStatus.Cancelled:
                    throw new Exception("Cannot send reminders for a cancelled workflow.");
                case WorkflowStatus.Completed:
                    response.Status = "info"; response.Message = "Workflow already completed; no reminders sent."; return response;
                case WorkflowStatus.Expired:
                    response.Status = "info"; response.Message = "Workflow expired; no reminders sent."; return response;
            }

            if (wfBasic.Status != WorkflowStatus.InProgress && wfBasic.Status != WorkflowStatus.Draft)
            {
                response.Status = "info"; response.Message = "Workflow not in a state that supports reminders."; return response;
            }

            // Gather envelopes currently in progress (sent but not completed)
            var envelopes = viewRepo.GetWorkflowEnvelopes(workflowId);
            var pending = envelopes
                .Where(e => e.Status == EnvelopeStatus.InProgress && e.WorkflowRecipient != null)
                .Select(e => e.WorkflowRecipient!)
                .ToList();

            var remindedIds = new List<int>();
            foreach (var recipient in pending)
            {
                try
                {
                    await SendReminderToRecipientAsync(recipient.WorkflowRecipientId);
                    remindedIds.Add(recipient.WorkflowRecipientId);
                }
                catch (Exception ex)
                {
                    Logger.Logg(LoggLevel.Error, $"[RemindNow] Failed for recipient {recipient.WorkflowRecipientId}: {ex.Message}", ex);
                }
            }

            // Touch workflow last updated time if any reminders dispatched
            if (remindedIds.Count > 0)
            {
                var (updSts, updMsg) = updateRepo.UpdateWorkflowLastUpdatedTime(workflowId, DateTime.Now);
                if (updSts == "error") Logger.Logg(LoggLevel.Info, $"Workflow {workflowId}: last-updated refresh failed: {updMsg}");
            }

            response.Status = "success";
            response.Message = remindedIds.Count == 0 ? "No pending recipients to remind." : "Reminders sent.";
            response.Data = new
            {
                WorkflowId = workflowId,
                TotalPending = pending.Count,
                TotalReminded = remindedIds.Count,
                RemindedRecipientIds = remindedIds
            };
        }
        catch (Exception e)
        {
            response.Status = "error";
            response.Message = e.Message;
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return response;
    }

    // Sends reminder to a single pending recipient.
    public async Task<ApiResponse<object>> RemindRecipientAsync(int recipientId)
    {
        var response = new ApiResponse<object>();
        try
        {
            var (sts, msg, recipient) = viewRepo.GetRecipientDetails(recipientId);
            if (sts == "error") throw new Exception(msg);
            if (recipient == null) throw new Exception("Recipient not found");
            
            var envelope = recipient.WorkflowEnvelope;
            if (envelope == null) throw new Exception("Envelope not found for recipient");
            
            var wf = envelope.Workflow;
            if (wf == null) throw new Exception("Workflow not found");
            switch (wf.Status)
            {
                case WorkflowStatus.Cancelled:
                    throw new Exception("Workflow cancelled; cannot remind recipient.");
                case WorkflowStatus.Completed:
                    throw new Exception("Workflow completed; no reminders needed.");
                case WorkflowStatus.Expired:
                    throw new Exception("Workflow expired; cannot remind recipient.");
                case WorkflowStatus.None:
                case WorkflowStatus.Draft:
                case WorkflowStatus.InProgress:
                    break;
                default:
                    throw new ArgumentOutOfRangeException();
            }

            if (envelope.Status != EnvelopeStatus.InProgress) throw new Exception("Recipient envelope not in progress; reminder not applicable.");

            await SendReminderToRecipientAsync(recipientId);
            var (updSts, updMsg) = updateRepo.UpdateWorkflowLastUpdatedTime(wf.WorkFlowId, DateTime.Now);
            if (updSts == "error") Logger.Logg(LoggLevel.Info, $"Workflow {wf.WorkFlowId}: last-updated refresh failed: {updMsg}");
            response.Status = "success"; response.Message = "Reminder sent"; response.Data = new { RecipientId = recipientId, WorkflowId = wf.WorkFlowId };
        }
        catch (Exception e)
        {
            response.Status = "error"; response.Message = e.Message; Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return response;
    }
    
    // Retrieves a paginated list of workflows created by the current user,
    // supports searching, sorting (ascending/descending), and paging for efficient display in the UI table.
    public ApiResponse<BasePagedResponseDto<WorkflowSummaryDto>> GetWorkflows(GetWorkflowsDto  workflowsDto)
    {
         var apiResponse = new ApiResponse<BasePagedResponseDto<WorkflowSummaryDto>>();
         try
         {
             var currentUser = curUser.GetCurrentUser();
             if(currentUser == null)
                 throw new Exception("User is not logged in..");
             
             var (status,message,workflows) = viewRepo.GetWorkflows(new Guid(currentUser.UserId!), workflowsDto);
             apiResponse.Data = new BasePagedResponseDto<WorkflowSummaryDto>
             {
                 Items = autoMapper.Map<List<WorkflowSummaryDto>>(workflows),
                 TotalCount = viewRepo.GetWorkflowsCount(currentUser.UserId!),
                 PageNumber = workflowsDto.PageNumber,
                 PageSize = workflowsDto.PageSize,
             };
             apiResponse.Message = message;
             apiResponse.Status = status;
         }
         catch (Exception e)
         {
             Logger.Logg(LoggLevel.Error, e.Message, e);
             apiResponse.Message = "An error occurred while fetching workflows.";
         }
         return apiResponse;
    }

    // Retrieves sign forms (envelopes) where the current user is a signer, applying filters and pagination.
    public ApiResponse<SignFormsSummaryDto> GetSignForms(GetSignFormsRequestDto requestDto)
    {
        var apiResponse = new ApiResponse<SignFormsSummaryDto>();
        try
        {
            var currentUser = curUser.GetCurrentUser();
            if (currentUser == null)
                throw new Exception("User is not logged in.");

            var (sts, msg, envelopes) = viewRepo.GetUserSignForms(new Guid(currentUser.UserId!));
            if (sts == "error")
                throw new Exception(msg);

            var now = DateTime.Now;
            var fullItems = new List<SignFormDto>();
            foreach (var env in envelopes)
            {
                if (env.Workflow == null || env.WorkflowRecipient == null)
                    continue;
                var wf = env.Workflow;
                var requestedAt = env.SentAt ?? wf.CreatedOn;
                DateTime? dueDate = wf.ValidUntil != default ? wf.ValidUntil.ToDateTime(TimeOnly.MinValue) : null;
                string status;
                if (env.Status == EnvelopeStatus.Completed)
                    status = "Signed";
                else if (env.Status == EnvelopeStatus.Expired || (wf.ValidUntil != default && wf.ValidUntil < DateOnly.FromDateTime(now)))
                    status = "Expired";
                else
                    status = "Pending";

                fullItems.Add(new SignFormDto
                {
                    Id = env.WorkflowEnvelopeId.ToString(),
                    Title = wf.WorkflowName ?? $"Workflow {wf.WorkFlowId}",
                    Requester = wf.User != null ? wf.User.Fname : "Unknown",
                    RequestedAt = requestedAt,
                    DueDate = dueDate,
                    Status = status,
                    Pages = null
                });
            }

            // Date range filtering
            if (!string.IsNullOrWhiteSpace(requestDto.DateRange) && requestDto.DateRange != "all")
            {
                int days = requestDto.DateRange switch
                {
                    "7d" => 7,
                    "30d" => 30,
                    "90d" => 90,
                    _ => 0
                };
                if (days > 0)
                {
                    var threshold = now.AddDays(-days);
                    fullItems = fullItems.Where(i => i.RequestedAt >= threshold).ToList();
                }
            }

            // Status filtering
            if (requestDto.Statuses != null && requestDto.Statuses.Any())
                fullItems = fullItems.Where(i => requestDto.Statuses.Contains(i.Status)).ToList();

            // Search filtering
            if (!string.IsNullOrWhiteSpace(requestDto.SearchTerm))
            {
                var search = requestDto.SearchTerm.ToLower();
                fullItems = fullItems.Where(i =>
                    (i.Title != null && i.Title.ToLower().Contains(search)) ||
                    (i.Requester != null && i.Requester.ToLower().Contains(search))
                ).ToList();
            }

            // Sorting
            var sortKey = requestDto.SortBy?.ToLower();
            Func<SignFormDto, object?> keySelector = sortKey switch
            {
                "title" => i => i.Title,
                "duedate" => i => i.DueDate ?? DateTime.MaxValue,
                "requestedat" => i => i.RequestedAt,
                _ => i => i.RequestedAt
            };
            fullItems = requestDto.IsDescending ? fullItems.OrderByDescending(keySelector).ToList() : fullItems.OrderBy(keySelector).ToList();

            var totalFiltered = fullItems.Count;
            var pagedItems = fullItems
                .Skip((requestDto.PageNumber - 1) * requestDto.PageSize)
                .Take(requestDto.PageSize)
                .ToList();

            var summary = new SignFormsSummaryDto
            {
                Items = pagedItems,
                TotalPending = fullItems.Count(i => i.Status == "Pending"),
                TotalSigned = fullItems.Count(i => i.Status == "Signed"),
                TotalExpired = fullItems.Count(i => i.Status == "Expired"),
                TotalAll = totalFiltered
            };

            apiResponse.Data = summary;
            apiResponse.Status = "success";
            apiResponse.Message = "Sign forms retrieved successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
            apiResponse.Status = "error";
            apiResponse.Message = e.Message;
        }
        return apiResponse;
    }

    // Retrieves detailed signing context for a single envelope (sign form) including recipients & fields
    public ApiResponse<SignFormSigningDetailsDto> GetSignFormDetails(int envelopeId)
    {
        var response = new ApiResponse<SignFormSigningDetailsDto>();
        try
        {
            var (sts, msg, envelope) = viewRepo.GetEnvelopeById(envelopeId);
            if (sts == "error") throw new Exception(msg);
            if (envelope == null)
            {
                response.Status = "error"; response.Message = "Envelope not found"; return response;
            }

            var wf = envelope.Workflow;
            if (wf == null) throw new Exception("Associated workflow not found");
            // Guard: do not surface sign form details if parent workflow is Cancelled
            if (wf.Status == WorkflowStatus.Cancelled)
            {
                response.Status = "error";
                response.Message = "Workflow cancelled; sign form unavailable";
                return response;
            }

            // Determine if expired
            var nowDate = DateOnly.FromDateTime(DateTime.Now);
            var isExpired = wf.ValidUntil != default && wf.ValidUntil < nowDate;
            // Fetch all envelopes once and project recipients with AutoMapper for fields
            var workflowEnvelopes = viewRepo.GetWorkflowEnvelopes(wf.WorkFlowId);
            var recipients = workflowEnvelopes
                .Where(env => env.WorkflowRecipient != null)
                .Select(env =>
                {
                    var r = env.WorkflowRecipient!;
                    var user = r.UseDefaultUser ? r.TemplateRecipient?.DefaultUser : r.User;
                    var name = user != null ? (user.Fname + (string.IsNullOrWhiteSpace(user.Lname) ? "" : " " + user.Lname)) : null;
                    var fields = r.TemplateRecipient?.TemplateRecipientField != null
                        ? autoMapper.Map<List<SignFormFieldDto>>(r.TemplateRecipient.TemplateRecipientField.Where(f => f.Field != null))
                        : new List<SignFormFieldDto>();
                    // ensure TemplateRecipientId populated for each field
                    foreach (var f in fields) f.TemplateRecipientId ??= r.TemplateRecipientId;
                    return new SignFormRecipientDetailsDto
                    {
                        WorkflowRecipientId = r.WorkflowRecipientId,
                        TemplateRecipientId = r.TemplateRecipientId,
                        Name = name,
                        Email = user?.Email,
                        RoleName = r.TemplateRecipient?.RecipientRole?.Role,
                        RolePriority = r.TemplateRecipient?.RecipientRole?.RolePriority ?? 0,
                        DeliveryType = r.TemplateRecipient?.DeliveryType ?? DeliveryType.NeedsToSign,
                        UseDefaultUser = r.UseDefaultUser,
                        EnvelopeStatus = env.Status.ToString(),
                        IsCurrentSigner = env.WorkflowEnvelopeId == envelopeId,
                        Fields = fields
                    };
                })
                .ToList();

            var fieldDtos = recipients.SelectMany(r => r.Fields).ToList();

            var requester = wf.User;
            var dto = new SignFormSigningDetailsDto
            {
                EnvelopeId = envelope.WorkflowEnvelopeId,
                WorkflowId = wf.WorkFlowId,
                TemplateId = wf.TemplateId,
                WorkflowName = wf.WorkflowName,
                DocumentName = wf.WorkflowName, // fallback: use workflow name as document title
                RequesterName = requester != null ? (requester.Fname + (string.IsNullOrWhiteSpace(requester.Lname) ? "" : " " + requester.Lname)) : null,
                RequesterEmail = requester?.Email,
                EnvelopeStatus = envelope.Status.ToString(),
                WorkflowStatus = wf.Status.ToString(),
                ValidUntil = wf.ValidUntil != default ? wf.ValidUntil : null,
                IsSequentialSigningEnabled = wf.Template?.IsSequentialSigningEnabled ?? false,
                IsExpired = isExpired,
                AlreadySigned = envelope.Status == EnvelopeStatus.Completed,
                CanSign = !isExpired && envelope.Status is EnvelopeStatus.InProgress or EnvelopeStatus.Draft,
                Recipients = recipients,
                Fields = fieldDtos
            };

            // Attach a signing token for the current signer to avoid extra client calls
            if (dto.CanSign && !dto.AlreadySigned && !dto.IsExpired)
            {
                var current = recipients.FirstOrDefault(r => r.IsCurrentSigner) ?? recipients.OrderBy(r => r.RolePriority).FirstOrDefault();
                if (current != null)
                {
                    var (tokStatus, tokMsg, token) = signingTokenRepo.GetOrReuseToken(current.WorkflowRecipientId, TimeSpan.FromMinutes(60));
                    if (tokStatus.Equals("success") && !string.IsNullOrWhiteSpace(token))
                    {
                        dto.Token = token;
                    }
                    else
                    {
                        Logger.Logg(LoggLevel.Warn, $"Failed to include signing token in details for recipient {current.WorkflowRecipientId}: {tokMsg}");
                    }
                }
            }

            response.Data = dto;
            response.Status = "success";
            response.Message = "Sign form details retrieved";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
            response.Status = "error";
            response.Message = e.Message;
        }
        return response;
    }
    
    public ApiResponse<WorkflowDetailsDto> GetWorkflowDetails(int workflowId)
    {
        var apiResponse = new ApiResponse<WorkflowDetailsDto>();
        try
        {
            var (fetchSts, stsMsg, workflowDetails) = viewRepo.GetWorkflowDetails(workflowId);
            apiResponse.Status = fetchSts;
            apiResponse.Message = stsMsg;
            if (workflowDetails == null)
            {
                apiResponse.Data = null!;
                return apiResponse;
            }

            // Base mapping (Recipients/Documents/Progress populated manually)
            var dto = autoMapper.Map<WorkflowDetailsDto>(workflowDetails);

            var envelopes = workflowDetails.WorkflowEnvelopes?.ToList() ?? new List<WorkflowEnvelope>();
            var documentsLookup = new Dictionary<int, SignedDocumentDetailsDto>();

            foreach (var env in envelopes)
            {
                var recipient = env.WorkflowRecipient;
                if (recipient == null) continue;

                var signatureDtos = new List<WorkflowRecipientSignatureDetailsDto>();
                var hasSigned = false;
                if (recipient.RecipientSignatures != null)
                {
                    foreach (var sig in recipient.RecipientSignatures)
                    {
                        var sigDto = autoMapper.Map<WorkflowRecipientSignatureDetailsDto>(sig);
                        var doc = sig.WorkflowRecipientSignedDocument;
                        if (doc != null)
                        {
                            if (!documentsLookup.TryGetValue(doc.SignedDocumentId, out var docDto))
                            {
                                docDto = autoMapper.Map<SignedDocumentDetailsDto>(doc);
                                documentsLookup[doc.SignedDocumentId] = docDto;
                            }
                            var versions = doc.SignedDocumentVersions != null
                                ? autoMapper.Map<List<SignedDocumentVersionDto>>(doc.SignedDocumentVersions.OrderBy(v => v.VersionNumber))
                                : new List<SignedDocumentVersionDto>();
                            docDto.Versions = versions;
                            docDto.LatestVersionNumber = versions.Count == 0 ? 0 : versions.Max(v => v.VersionNumber);
                            sigDto.Versions = versions;
                            sigDto.LatestVersionNumber = docDto.LatestVersionNumber;
                            hasSigned = hasSigned || sig.IsSigned;
                        }
                        signatureDtos.Add(sigDto);
                    }
                }

                var templateDefault = recipient.TemplateRecipient?.DefaultUser;
                var customUser = recipient.User;
                var resolvedUser = recipient.UseDefaultUser ? templateDefault : customUser;
                var resolvedName = resolvedUser != null ? (resolvedUser.Fname + " " + resolvedUser.Lname).Trim() : "Unknown";
                var resolvedEmail = resolvedUser?.Email;

                var recipientDto = autoMapper.Map<WorkflowRecipientDetailsDto>(recipient);
                recipientDto.DisplayName = resolvedName;
                recipientDto.Email = resolvedEmail;
                recipientDto.ResolvedUserName = resolvedName;
                recipientDto.ResolvedUserEmail = resolvedEmail;
                recipientDto.EnvelopeStatus = env.Status;
                recipientDto.EnvelopeSentAt = env.SentAt;
                recipientDto.EnvelopeCompletedAt = env.CompletedAt;
                recipientDto.HasSigned = hasSigned;
                recipientDto.Signatures = signatureDtos;
                dto.Recipients.Add(recipientDto);
            }

            dto.Documents = documentsLookup.Values.ToList();

            var totalRecipients = dto.Recipients.Count;
            var totalEnvelopes = envelopes.Count;
            var signedRecipients = dto.Recipients.Count(r => r.HasSigned);
            var completedEnvelopes = envelopes.Count(e => e.Status == EnvelopeStatus.Completed);
            var signaturePct = totalRecipients == 0 ? 0 : (double)signedRecipients / totalRecipients * 100.0;
            var envelopePct = totalEnvelopes == 0 ? 0 : (double)completedEnvelopes / totalEnvelopes * 100.0;
            var overallPct = (signaturePct + envelopePct) / 2.0;
            dto.Progress = new WorkflowEmbeddedProgressDto
            {
                TotalRecipients = totalRecipients,
                TotalEnvelopes = totalEnvelopes,
                SignedRecipients = signedRecipients,
                CompletedEnvelopes = completedEnvelopes,
                SignatureProgressPct = Math.Round(signaturePct, 2),
                EnvelopeProgressPct = Math.Round(envelopePct, 2),
                OverallProgressPct = Math.Round(overallPct, 2)
            };

            apiResponse.Data = dto;
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }

        return apiResponse;
    }

    public async Task<ApiResponse<object>> UpdateWorkflowDetails(UpdateWorkflowDto updateWorkflowDto)
    {
        var apiResponse = new ApiResponse<object>();
        try
        { 
            var (wfStatus, _, workflowDetails) = viewRepo.GetWorkFlowBasicDetails(updateWorkflowDto.WorkFlowId);
            if (wfStatus.Equals("error"))
            {
                apiResponse.Message = "Cannot find workflow details.";
                return apiResponse;
            }
            // Persist the old values for reminder rescheduling comparison
            var oldReminderInterval = workflowDetails.ReminderIntervalInDays;
            var oldValidUntil = workflowDetails.ValidUntil;

            // Apply incoming DTO changes onto entity (only updatable fields)
            if (!string.IsNullOrWhiteSpace(updateWorkflowDto.WorkflowName))
                workflowDetails.WorkflowName = updateWorkflowDto.WorkflowName!.Trim();
            workflowDetails.ValidUntil = updateWorkflowDto.ValidUntil; // DateOnly is a struct; overwrite directly
            workflowDetails.ReminderIntervalInDays = updateWorkflowDto.ReminderIntervalInDays;

            // Use update repository (write operation) rather than view repository
            var (updateStatus, updateMsg) = updateRepo.UpdateWorkflowDetails(workflowDetails);
            if (updateStatus.Equals("error"))
            {
                apiResponse.Message = updateMsg;
                apiResponse.Status = updateStatus;
                return apiResponse;
            }

            // If reminder interval or validity period changed, reschedule reminders
            if (updateWorkflowDto.ReminderIntervalInDays != oldReminderInterval ||
                updateWorkflowDto.ValidUntil != oldValidUntil)
            {
                await CancelWorkflowRemindersAsync(updateWorkflowDto.WorkFlowId);

                var reminderInterval = updateWorkflowDto.ReminderIntervalInDays;
                var daysRemaining = (updateWorkflowDto.ValidUntil.ToDateTime(TimeOnly.MinValue) - DateTime.Now).Days;
                var repeatCount = Math.Max(0, daysRemaining - 1);

                if (repeatCount > 0 && reminderInterval > 0)
                    await ScheduleWorkflowReminders(updateWorkflowDto.WorkFlowId, reminderInterval, repeatCount);
            }

            apiResponse.Status = "success";
            apiResponse.Message = "Workflow details updated successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
            apiResponse.Message = "An exception occurred while updating workflow details.";
        }

        return apiResponse;
    }

    public ApiResponse<WorkflowProgressDto> GetWorkflowProgress(int workflowId)
    {
        var apiResponse = new ApiResponse<WorkflowProgressDto>();
        try
        {
            var (fetchSts, stsMsg, workflowDetails) = viewRepo.GetWorkflowDetails(workflowId);
            apiResponse.Status = fetchSts;
            apiResponse.Message = stsMsg;
            if (workflowDetails == null)
            {
                apiResponse.Data = null!;
                return apiResponse;
            }
            // Base scalar mapping via AutoMapper; collections & percentages populated below
            var progressDto = autoMapper.Map<WorkflowProgressDto>(workflowDetails);

            var envelopes = workflowDetails.WorkflowEnvelopes.ToList();
            // Gather recipients (each envelope should have one recipient link)
            var recipients = envelopes.Select(e => e.WorkflowRecipient).Where(r => r != null).ToList()!;
            // Flatten all signatures from recipients
            var signatures = recipients.SelectMany(r => r!.RecipientSignatures ?? new List<WorkflowRecipientSignature>()).ToList();

            // Envelope progress counts
            var envelopeProgress = new EnvelopeProgressDto
            {
                Total = envelopes.Count,
                Draft = envelopes.Count(e => e.Status == EnvelopeStatus.Draft),
                InProgress = envelopes.Count(e => e.Status == EnvelopeStatus.InProgress),
                Completed = envelopes.Count(e => e.Status == EnvelopeStatus.Completed),
                Failed = envelopes.Count(e => e.Status == EnvelopeStatus.Failed),
                Expired = envelopes.Count(e => e.Status == EnvelopeStatus.Expired)
            };

            // Recipient progress (currently only total; can extend later)
            var recipientProgress = new RecipientProgressDto { Total = recipients.Count };

            // Signature progress (required signatures determined by delivery type NeedsToSign)
            var requiredSignatureCount = recipients.Count(r => r!.TemplateRecipient?.DeliveryType == DeliveryType.NeedsToSign);
            var signatureProgress = new SignatureProgressDto
            {
                Required = requiredSignatureCount,
                Created = signatures.Count,
                Completed = signatures.Count(s => s.IsSigned)
            };

            // Percentage calculations (guard division by zero)
            var envelopePct = envelopeProgress.Total > 0 ? (double)envelopeProgress.Completed / envelopeProgress.Total * 100.0 : 0.0;
            var signaturePct = signatureProgress.Required > 0 ? (double)signatureProgress.Completed / signatureProgress.Required * 100.0 : 0.0;
            var overallPct = (envelopePct + signaturePct) / 2.0;

            progressDto.Envelopes = envelopeProgress;
            progressDto.Recipients = recipientProgress;
            progressDto.Signatures = signatureProgress;
            progressDto.Percentages = new ProgressPercentagesDto
            {
                EnvelopeProgress = Math.Round(envelopePct, 2),
                SignatureProgress = Math.Round(signaturePct, 2),
                OverallProgress = Math.Round(overallPct, 2)
            };

            apiResponse.Data = progressDto;
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return apiResponse;
    }

    
    // Retrieves a list of roles that can be assigned to recipients in a workflow.
    public ApiResponse<object> GetRolesList()
    {
        var apiResponse = new ApiResponse<object>();
        try
        {
            var (status, message, roles) = viewRepo.GetRoles();
            apiResponse.Data = roles;
            apiResponse.Message = message;
            apiResponse.Status = status;
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return apiResponse;
    }
    
    // Adds a role to a workflow’s recipient configuration.
    public ApiResponse<object> AddRolesToWorkflow(TemplateRecipientRole role)
    {
        var apiResponse = new ApiResponse<object>();
        try
        {
            var (status, message) = updateRepo.AddRecipientRole(role);
            apiResponse.Message = message;
            apiResponse.Status = status;
        }
        catch(Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return apiResponse;
    }

    // Resends an envelope that is pending or previously failed/expired (if workflow still valid)
    public async Task<ApiResponse<object>> ResendEnvelopeAsync(int envelopeId)
    {
        var response = new ApiResponse<object>();
        try
        {
            // Fetch envelope with recipient + workflow context
            var (sts, msg, envelope) = viewRepo.GetEnvelopeById(envelopeId);
            if (sts == "error") throw new Exception(msg);
            if (envelope == null)
                throw new Exception("Envelope not found.");

            var wf = envelope.Workflow;
            if (wf == null)
                throw new Exception("Associated workflow not found.");

            // Guard: completed envelopes cannot be resent
            if (envelope.Status == EnvelopeStatus.Completed)
            {
                response.Status = "info";
                response.Message = "Envelope already completed.";
                return response;
            }

            // Guard: workflow validity window expired
            if (wf.ValidUntil != default && wf.ValidUntil < DateOnly.FromDateTime(DateTime.Now))
                throw new Exception("Workflow validity period has expired. Cannot resend envelope.");

            var recipient = envelope.WorkflowRecipient;
            if (recipient == null)
                throw new Exception("Envelope recipient details missing.");

            var recipientUser = recipient.UseDefaultUser ? recipient.TemplateRecipient?.DefaultUser : recipient.User;
            if (recipientUser == null)
                throw new Exception("Recipient user details not resolved.");

            // Attempt to send email
            var (mailStatus, mailMsg) = await SendEmailAsync(recipientUser.Email, "Signature Required", "Please sign the document.");
            if (mailStatus == "error")
                throw new Exception(mailMsg);

            // Update envelope status -> InProgress (sent)
            var (envSts, envMsg) = updateRepo.ChangeRecipientEnvelopeStatus(recipient.WorkflowRecipientId, EnvelopeStatus.InProgress);
            if (envSts == "error")
                throw new Exception(envMsg);

            // Touch workflow last updated time
            var (updSts, updMsg) = updateRepo.UpdateWorkflowLastUpdatedTime(wf.WorkFlowId, DateTime.Now);
            if (updSts == "error")
                Logger.Logg(LoggLevel.Info, $"Workflow {wf.WorkFlowId}: last-updated time not refreshed: {updMsg}");

            response.Status = "success";
            response.Message = "Envelope resent successfully.";
        }
        catch (Exception e)
        {
            response.Status = "error";
            response.Message = e.Message;
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return response;
    }
}