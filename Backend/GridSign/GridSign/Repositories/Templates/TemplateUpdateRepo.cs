using System.Reflection.Metadata;
using GridSign.Data;
using GridSign.Helpers;
using GridSign.Models.Entities;
using GridSign.Repositories.RepoHelper;
using GridSign.Repositories.Templates.Interfaces;
using Microsoft.EntityFrameworkCore; // Added for Include/ThenInclude chain in DeleteTemplate

namespace GridSign.Repositories.Templates;

public class TemplateUpdateRepo(ApplicationDbContext dbContext) : RepoUtility(dbContext),ITemplateUpdateRepo
{
    public (string tempSts, string tempMsg) CreateTemplate(Template template)
    { 
        var status = "error";
        var message = "Error occured while add the templates";
        try
        {
            DbContext.Template.Add(template);
            DbContext.SaveChanges(); 
            status = "success";
            message = "Template created successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message);
    }

    public (string docSts, string docMsg) CreateDocument(TemplateDocument document)
    {
        var status = "error";
        var message = "Error occurred while creating new Document"; 
        try
        {
            DbContext.Documents.Add(document);
            DbContext.SaveChanges(); 
            status = "success";
            message = "Document created successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }

        return (status, message);
    }

    public (string linkSts, string linkMsg) SyncDocFilesToTemplateDocs(int documentId, int resourceId)
    {
        var status = "error";
        var message = "Error occured while linking document"; 
        try
        {
            var docResource = new TemplateDocumentFiles {DocumentId = documentId,FileResourceId = resourceId};
            DbContext.DocumentAttachments.Add(docResource); 
            DbContext.SaveChanges(); 
            status = "success";
            message = "Document Resource Linked successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message);
    }

    public (string frSts, string frMsg) CreateFileResource(FileResource fileResource)
    {
        var status = "error";
        var message = "Error occured while adding file resource"; 
        try
        { 
            DbContext.FileResources.Add(fileResource);
            DbContext.SaveChanges(); 
            status = "success";
            message = "File Resource Added successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message);
    }

    public (string fldSts, string fldMsg) CreateFieldList(List<Field> field)
    {
        var status = "error";
        var message = "Error occured while adding the fields"; 
        try
        {
            DbContext.Fields.AddRange(field);
            DbContext.SaveChanges(); 
            status = "success";
            message = "Fields Added successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message);
    }
    
    public (string linkSts, string linkMsg) AddRecipientFieldList(List<TemplateRecipientField> templateRecipientField)
    {
        var status = "error";
        var message = "Error occured while adding recipient fields";
        try
        {
            DbContext.TemplateRecipientFields.AddRange(templateRecipientField);
            DbContext.SaveChanges();
            status = "success";
            message = "Recipient fields created successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message);
    }

    public (string recSts, string recMsg) CreateTemplateRecipient(TemplateRecipient templateRecipient)
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

    public (string delSts, string delMsg) DeleteTemplate(int templateId)
    {
        var status = "error";
        var message = "Error occurred while deleting template";
        try
        {
            var template = DbContext.Template
                .Include(t => t.Documents)!
                    .ThenInclude(d => d.TemplateRecipients)!
                        .ThenInclude(r => r.TemplateRecipientField)
                .Include(t => t.Documents)!
                    .ThenInclude(d => d.TemplateDocumentFiles)
                .FirstOrDefault(t => t.TemplateId == templateId);

            if (template == null)
                return (status, "Template not found"); 
            
            DbContext.Template.Remove(template);
            DbContext.SaveChanges();
            status = "success";
            message = "Template deleted successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message);
    }
}