using GridSign.Data;
using GridSign.Helpers; 
using GridSign.Models.Entities;
using GridSign.Repositories.RepoHelper;
using GridSign.Repositories.SignWorkFlow.Interfaces;  

namespace GridSign.Repositories.SignWorkFlow;

public class SignWorkFlowUpdateRepo(ApplicationDbContext dbContext) : RepoUtility(dbContext),ISignWorkFlowUpdateRepo
{
    public (string wfSts, string wfMsg) CreateNewWorkflow(Workflow workflow)
    { 
        var status = "error";
        var message = "Error occured while creating new workflow";
        try
        {
            DbContext.Workflow.Add(workflow);
            DbContext.SaveChanges(); 
            status = "success";
            message = "Workflow created successfully!";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message);
    }
   
    public (string envSts, string envMsg) CreateWorkflowEnvelopeList(List<WorkflowEnvelope> workflowEnvelope)
    {
        var status = "error";
        var message = "Error occured while creating new Envelopes"; 
        try
        {
            DbContext.WorkflowEnvelope.AddRange(workflowEnvelope);
            DbContext.SaveChanges(); 
            status = "success";
            message = "Envelopes created successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message);
    }

    public (string recSts, string recMsg) AddRecipient(TemplateRecipient templateRecipient)
    {
        var status = "error";
        var message = "Error occured while adding recipient"; 
        try
        {
            DbContext.TemplateRecipient.Add(templateRecipient);
            DbContext.SaveChanges(); 
            status = "success";
            message = "Recipient created successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message);
    }

    public (string, string) CreateNewWorkflowRecipientSignature(WorkflowRecipientSignature workflowRecipientSignature)
    {
        var status = "error";
        var message = "Error occured while signing the Document";  
        try
        {
            DbContext.WorkflowRecipientSignature.Add(workflowRecipientSignature);
            DbContext.SaveChanges();  
            message = "Document Signed Successfully";
            status = "success";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message);
    }

    public (string, string) ToggleWorkflowCompletedStatus(int workflowId, WorkflowStatus workflowStatus)
    {
        var status = "error";
        var message = "Error occured while toggling the Workflow Attribute";
        try
        {
            DbContext.Workflow.FirstOrDefault(wf => wf.WorkFlowId == workflowId)!.Status = workflowStatus;
            DbContext.SaveChanges();
            status = "success";
            message = "Document Signed Successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }

        return (status, message);
    }
    
    public (string, string) AddRecipientRole(TemplateRecipientRole role)
    {
        var status = "error";
        var message = "Error occured while add the role which is already exists";
        try
        {
            var recipient = new TemplateRecipientRole { Role = role.Role, RolePriority = role.RolePriority };
            if (!DbContext.RecipientRole.Any(r => r.Role == role.Role))
            {
                DbContext.RecipientRole.Add(recipient);
                DbContext.SaveChanges();
                status = "success";
                message = "Role Added to Workflow";
            }
            else
            {
                status = "error";
                message = "Role already exists";
            }
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }

        return (status, message);
    }
    
    public (string fldSts, string fldMsg, int fieldId) AddField(Field field)
    {
        var status = "error";
        var message = "Error occured while adding the field";
        var recipientId = 0;
        try
        {
            DbContext.Fields.Add(field);
            DbContext.SaveChanges();
            recipientId = field.FieldId;
            status = "success";
            message = "Field Added successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message, recipientId);
    }

    public (string linkSts, string linkMsg) AddRecipientField(TemplateRecipientField templateRecipientField)
    {
        var status = "error";
        var message = "Error occured while adding recipient";
        try
        {
            DbContext.TemplateRecipientFields.Add(templateRecipientField);
            DbContext.SaveChanges();
            status = "success";
            message = "Recipient field created successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message);
    }

    public (string frSts, string frMsg, int resourceId) AddFileResource(byte[] fileBytes, string? documentName,
        FileResourceType fileType, string? resourceCreatorId)
    {
        var status = "error";
        var message = "Error occured while adding file resource";
        var fileResourceId = 0;
        try
        {
            var resource = new FileResource
            { 
                ResourceData = fileBytes,
                ResourceName = documentName, 
                FileType = fileType,
                UploadedByUserId = new Guid(resourceCreatorId!)
            };
            DbContext.FileResources.Add(resource);
            DbContext.SaveChanges();
            fileResourceId = resource.FileResourceId;
            status = "success";
            message = "File Resource Added successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message, fileResourceId);
    }

    public (string status,string message) ChangeRecipientEnvelopeStatus(int wfEnvelopeId, EnvelopeStatus envelopeStatus)
    {
        var status = "error";
        var message = "Error occured while changing recipient status";
        try
        {
            DbContext.WorkflowEnvelope.FirstOrDefault(r => r.WorkflowEnvelopeId == wfEnvelopeId)!.Status = envelopeStatus;
            DbContext.SaveChanges();
            status = "success";
            message = "Recipient Envelope status changed successfully..";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message);
    }
 
    public (string status, string message) CreateWorkflowSignedDocument( WorkflowRecipientSignedDocument workflowRecipientSignedDocument)
    {
        var status = "error";
        var message = "An error occurred while creating the workflow signed document"; 
        try
        {
           DbContext.WorkflowRecipientSignedDocument.Add(workflowRecipientSignedDocument);
           DbContext.SaveChanges();
           status = "success";
           message = "Workflow Recipient Signed Document created successfully"; 
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message);
    }

    public (string sts, string stsMsg) UpdateWorkflowLastUpdatedTime(int workflowId, DateTime now)
    {
        var status = "error";
        var message = "An exception occurred while updating workflow last updated time.";
        try
        {
            var workflow = DbContext.Workflow.FirstOrDefault(wf => wf.WorkFlowId == workflowId);
            if (workflow == null)
                throw new Exception("Workflow not found");
            
            workflow.LastUpdatedDate = now;
            DbContext.Workflow.Update(workflow);
            DbContext.SaveChanges();
            status = "success";
            message = "Workflow last updated time has been updated successfully.";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message);
    }

    public (string status, string message) UpdateWorkflowDetails(Workflow workflow)
    {
        var status = "error";
        var message = "An error occurred while updating workflow";
        try
        {
            DbContext.Workflow.Update(workflow);
            DbContext.SaveChanges();
            status = "success";
            message = "Workflow updated successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message);
    }

    public (string status, string message) DeleteWorkflow(int workflowId)
    {
        var status = "error";
        var message = "An error occurred while deleting workflow";
        try
        {
            var wf = DbContext.Workflow.FirstOrDefault(w => w.WorkFlowId == workflowId);
            if (wf == null)
                return ("error", "Workflow not found");
            
            // Guard: prevent deletion if workflow is in progress
            if (wf.Status == WorkflowStatus.InProgress)
                return ("error", "Cannot delete an in-progress workflow.");
 
            DbContext.Workflow.Remove(wf);
            DbContext.SaveChanges();
            status = "success";
            message = "Workflow deleted successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message);
    }

    public (string updateSts, string stsMsg) CreateNewSignedDocumentVersion(SignedDocumentVersion newVersion)
    {
         var status = "error";
         var message = "Error occured while creating new document version";
         try
         {
             DbContext.SignedDocumentVersion.Add(newVersion);
             DbContext.SaveChanges();
             status = "success";
             message = "Document version created successfully";
         }
         catch (Exception e)
         {
             Logger.Logg(LoggLevel.Error, e.Message, e);
         }
         return (status, message);
    }

    public (string proofLinkSts, string proofLinkMsg) AddProofToRecipientSignature(int recipientSignatureId, int proofResourceId)
    {
        var status = "error";
        var message = "Error occured while adding proof to Recipient Signature"; 
        try
        {
            var signatureProof = new WorkflowSignatureProof {FileResourceId = proofResourceId,SignatureProofId = recipientSignatureId};
            DbContext.SignatureProof.Add(signatureProof);  
            DbContext.SaveChanges(); 
            status = "success";
            message = "Signature Proof added to Recipient Signature successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message);
    }

    public (string status, string message) CreateWorkflowRecipientsWithEnvelopes(List<WorkflowRecipient> workflowRecipientList)
    {
        var status = "error";
        var message = "Error occured while creating workflow recipient"; 
        try
        {
            DbContext.WorkflowRecipient.AddRange(workflowRecipientList);
            DbContext.SaveChanges(); 
            status = "success";
            message = "Workflow Recipient created successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message);
    }
}

