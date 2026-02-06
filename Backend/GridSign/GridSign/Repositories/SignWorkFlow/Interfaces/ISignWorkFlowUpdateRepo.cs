using GridSign.Models.DTOs.RequestDTO;
using GridSign.Models.Entities;
using GridSign.Repositories.RepoHelper.Interfaces;
using Microsoft.EntityFrameworkCore.Storage;

namespace GridSign.Repositories.SignWorkFlow.Interfaces;

public interface ISignWorkFlowUpdateRepo : IRepoUtility
{
    (string, string) CreateNewWorkflowRecipientSignature(WorkflowRecipientSignature workflowRecipientSignature);
    (string wfTSts, string wfTMsg) ToggleWorkflowCompletedStatus(int workflowId, WorkflowStatus status); 
    (string recipientSts, string recipientMsg) AddRecipientRole(TemplateRecipientRole templateRecipient); 
    (string wfSts, string wfMsg) CreateNewWorkflow(Workflow workflow);
    (string envSts, string envMsg) CreateWorkflowEnvelopeList(List<WorkflowEnvelope> workflowEnvelope);   
    (string frSts, string frMsg, int resourceId) AddFileResource(byte[] fileBytes, string? documentName, FileResourceType toSignDoc, string? workflowCreatorUserId);
    (string proofLinkSts, string proofLinkMsg) AddProofToRecipientSignature(int recipientSignatureId, int proofResourceId);
    (string status, string message) CreateWorkflowRecipientsWithEnvelopes(List<WorkflowRecipient> workflowRecipient);
    (string status, string message) ChangeRecipientEnvelopeStatus(int wfEnvelopeId, EnvelopeStatus envelopeStatus);
    (string updateSts, string stsMsg) CreateNewSignedDocumentVersion(SignedDocumentVersion newVersion);
    (string status, string message) CreateWorkflowSignedDocument(WorkflowRecipientSignedDocument workflowRecipientSignedDocument);
    (string sts, string stsMsg) UpdateWorkflowLastUpdatedTime(int workflowId, DateTime now);
    (string status, string message) UpdateWorkflowDetails(Workflow workflow);
    (string status, string message) DeleteWorkflow(int workflowId);
}