using System.Collections;
using GridSign.Models.DTOs.CommonDTO;
using GridSign.Models.DTOs.RequestDTO;
using GridSign.Models.Entities;

namespace GridSign.Repositories.SignWorkFlow.Interfaces;

public interface ISignWorkFlowViewRepo
{
   (string status, string message, WorkflowRecipient workflowRecipient) GetRecipientDetails(int recipientId);
   int? GetWorkflowId(int recipientId);
   List<WorkflowRecipient> GetWorkflowRecipients(int workflowId);
   int GetWorkflowsCount(string workflowOwner);
   (string,string,List<TemplateRecipientRole>) GetRoles();
   (string status, string message, Workflow? workflowDetails) GetWorkflowRecipientDetials(int workflowId); 
   List<WorkflowEnvelope> GetWorkflowEnvelopes(int workflowId);
   bool GetIsSequentialSigningEnabled(int workflowId);
   (string status, string message, WorkflowRecipientSignedDocument? recipientSignedDocument) GetWorkflowSignedDocument(int workflowId);
   (string vSts, string vStsMsg, int lasVersion) GetLatestSignedDocVersion(int signedDocumentId);
   (string status, string message, List<Workflow> workflows) GetWorkflows(Guid userId, GetWorkflowsDto requestDto);
   (string status, string message, Workflow workflowDetails) GetWorkFlowBasicDetails(int workflowId);
   (string status, string message, Workflow workflowDetails) GetWorkflowDetails(int workflowId);
   (string status, string message) UpdateWorkflowDetails(Workflow updateWorkflowDto);
   // Returns envelopes relevant to the specified user (as a signer) with necessary navigation properties.
   (string status, string message, List<WorkflowEnvelope> envelopes) GetUserSignForms(Guid userId);
   // Optimized server-side filtering & paging
   (string status, string message, List<WorkflowEnvelope> envelopes, int totalPending, int totalSigned, int totalExpired, int totalAll) GetUserSignForms(Guid userId, GetSignFormsRequestDto requestDto);
   // Single envelope fetch (for resend)
   (string status, string message, WorkflowEnvelope? envelope) GetEnvelopeById(int envelopeId);
}