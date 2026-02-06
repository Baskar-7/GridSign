using System.Reflection.Metadata;
using GridSign.Models.Entities;
using GridSign.Repositories.RepoHelper.Interfaces;

namespace GridSign.Repositories.Templates.Interfaces;

public interface ITemplateUpdateRepo :IRepoUtility
{
    (string tempSts, string tempMsg) CreateTemplate(Template template);
    (string docSts, string docMsg) CreateDocument(TemplateDocument document);
    (string linkSts, string linkMsg ) SyncDocFilesToTemplateDocs(int documentId, int resourceId); 
    (string fldSts, string fldMsg) CreateFieldList(List<Field> field); 
    (string linkSts,string linkMsg) AddRecipientFieldList(List<TemplateRecipientField> templateRecipientField);
    (string recSts, string recMsg) CreateTemplateRecipient(TemplateRecipient templateRecipient);
    (string frSts, string frMsg) CreateFileResource(FileResource fileResource);
    // Deletes a template and all dependent child entities (documents, recipients, recipient fields, attachments)
    // Guarded at service layer to ensure no workflows reference the template prior to invoking this.
    (string delSts, string delMsg) DeleteTemplate(int templateId);
}