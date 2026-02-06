using GridSign.Models.DTOs.RequestDTO;
using GridSign.Models.DTOs.ResponseDTO;
using GridSign.Models.Entities;

namespace GridSign.Repositories.Templates.Interfaces;

public interface ITemplateViewRepo
{
    (string status, string message, List<Template> templates) GetAllTemplates(string teplateOwner,
        GetTemplatesDto templatesDto);
    bool IsValidRecipientRole(int roleId);
    int TemplatesCount(string templateOwner);
    (string status, string message, Template template) GetTemplateDetails(int templateId);
    (string status, string message, List<TemplateRecipient> templateRecipientsList) GetTemplateRecipientsList(
        int templateId);
    (string status,string message, TemplateDetailsDto? templateDetailsDto) GetTemplateDetailsDto(int templateId);
    // Fetch a template ensuring ownership
    (string status, string message, Template? template) GetTemplateForOwner(int templateId, Guid ownerId);
    // Enumerate workflows referencing a template (id, name, status)
    (string status, string message, List<(int workflowId, string? workflowName, WorkflowStatus status)> workflows) GetTemplateWorkflowReferences(int templateId);
}