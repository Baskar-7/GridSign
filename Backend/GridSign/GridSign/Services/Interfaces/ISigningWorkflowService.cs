using GridSign.Models.DTOs.CommonDTO;
using GridSign.Models.DTOs.RequestDTO;
using GridSign.Models.DTOs.ResponseDTO;
using GridSign.Models.Entities;

namespace GridSign.Services.Interfaces;

public interface ISigningWorkflowService
{
    Task<ApiResponse<object>> CompleteDocumentSigningAsync(CompleteSigningReqDto signingReqDto,
        IFormFile signedDocument, IFormFile? proofImage = null);
    Task HandleSigningWorkflowAsync(int workflowId);
    Task SendReminderToRecipientAsync(int recipientId);
    Task<ApiResponse<object>> RemindWorkflowAsync(int workflowId);
    Task<ApiResponse<object>> RemindRecipientAsync(int recipientId);
    ApiResponse<object> AddRolesToWorkflow(TemplateRecipientRole role);
    ApiResponse<object> GetRolesList();
    Task<ApiResponse<object>> CreateWorkFlow(CreateWorkFlowDto workflowDto, IFormFile document);
    ApiResponse<BasePagedResponseDto<WorkflowSummaryDto>> GetWorkflows(GetWorkflowsDto workflowsDto);
    Task CancelWorkflowRemindersAsync(int workflowId);
        ApiResponse<WorkflowDetailsDto> GetWorkflowDetails(int workflowId);
    Task<ApiResponse<object>> UpdateWorkflowDetails(UpdateWorkflowDto updateWorkflowDto);
        ApiResponse<WorkflowProgressDto> GetWorkflowProgress(int workflowId);
    Task<ApiResponse<object>> StartWorkflowAsync(int workflowId, bool? autoReminder = null, int? reminderIntervalDays = null);
    Task<ApiResponse<object>> CancelWorkflowAsync(int workflowId, string? reason);
    Task<ApiResponse<object>> DeleteWorkflowAsync(int workflowId);
    // Retrieves sign forms (envelopes) for current user with filtering/paging
    ApiResponse<SignFormsSummaryDto> GetSignForms(GetSignFormsRequestDto requestDto);
    Task<ApiResponse<object>> ResendEnvelopeAsync(int envelopeId);
    // Retrieves detailed signing context for a single sign form (envelope) used by the signing page
    ApiResponse<SignFormSigningDetailsDto> GetSignFormDetails(int envelopeId); 
}