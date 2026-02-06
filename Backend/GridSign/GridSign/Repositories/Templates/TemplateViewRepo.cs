using GridSign.Data;
using GridSign.Helpers;
using GridSign.Models.DTOs.RequestDTO;
using GridSign.Models.DTOs.ResponseDTO;
using GridSign.Models.Entities;
using GridSign.Repositories.RepoHelper;
using GridSign.Repositories.Templates.Interfaces;
using Microsoft.EntityFrameworkCore; 

namespace GridSign.Repositories.Templates;

public class TemplateViewRepo(ApplicationDbContext dbContext) : RepoUtility(dbContext),ITemplateViewRepo
{
    public (string status,string message, List<Template> templates) GetAllTemplates(string templateOwner, GetTemplatesDto templatesDto)
    {
        var status = "error";
        var message = "Error occurred while fetching templates";
        var templatesList = new List<Template>();
        try
        {
             var templates = DbContext.Template
                .Include(t => t.Users)
                .Where(t => t.TemplateOwner.ToString() == templateOwner); 
            
            // Sequential & parallel signing filter
            if (templatesDto.SigningModeFilter != SigningModeFilter.All)
            {
                templates = templates.Where(t => 
                    (templatesDto.SigningModeFilter == SigningModeFilter.Sequential && t.IsSequentialSigningEnabled == true) ||
                    (templatesDto.SigningModeFilter == SigningModeFilter.Parallel && t.IsSequentialSigningEnabled == false)
                );
            }
            
            // Date Range Filter
            if (templatesDto.StartDate.HasValue)
                templates = templates.Where(w => w.CreatedOn >= templatesDto.StartDate.Value);

            if (templatesDto.EndDate.HasValue)
                templates = templates.Where(w => w.CreatedOn <= templatesDto.EndDate.Value);
            
            // Search 
            if (!string.IsNullOrWhiteSpace(templatesDto.SearchTerm))
            {
                var search = templatesDto.SearchTerm.ToLower();

                templates = templates.Where(t =>
                    (t.TemplateName != null && t.TemplateName.ToLower().Contains(search)) ||
                    (t.Description != null && t.Description.ToLower().Contains(search)) ||
                    (t.Users != null && t.Users.Fname.ToLower().Contains(search)) ||
                    (t.Users != null && t.Users.Lname.ToLower().Contains(search)) ||
                    (t.CreatedOn.ToString().ToLower().Contains(search))
                );
            }
            
            // Pre-compute usage counts (number of workflows created from each template)
            var usageCountsLookup = DbContext.Workflow
                .GroupBy(w => w.TemplateId)
                .Select(g => new { g.Key, Count = g.Count() })
                .ToDictionary(x => x.Key, x => x.Count);

            // Sorting (extended to support UsageCount)
            templates = templatesDto.SortBy?.ToLower() switch
            {
                "templatename" => templatesDto.IsDescending ? templates.OrderByDescending(t => t.TemplateName) : templates.OrderBy(t => t.TemplateName),
                "templateowner" => templatesDto.IsDescending ? templates.OrderByDescending(t => t.Users!.Fname) : templates.OrderBy(t => t.Users!.Fname),
                "createdat" => templatesDto.IsDescending ? templates.OrderByDescending(t => t.CreatedOn) : templates.OrderBy(t => t.CreatedOn),
                "usagecount" => templatesDto.IsDescending
                    ? templates.OrderByDescending(t => usageCountsLookup.ContainsKey(t.TemplateId) ? usageCountsLookup[t.TemplateId] : 0)
                    : templates.OrderBy(t => usageCountsLookup.ContainsKey(t.TemplateId) ? usageCountsLookup[t.TemplateId] : 0),
                _ => templatesDto.IsDescending ? templates.OrderByDescending(t => t.TemplateId) : templates.OrderBy(t => t.TemplateId)
            }; 
            
            templatesList = templates
                .Skip((templatesDto.PageNumber - 1) * templatesDto.PageSize)
                .Take(templatesDto.PageSize)
                .ToList();

            // Populate UsageCount runtime property for AutoMapper
            foreach (var t in templatesList)
            {
               var count = usageCountsLookup.TryGetValue(t.TemplateId, out var c) ? c : 0;
               t.TemplateStatus = count > 0 ? TemplateStatus.Active : TemplateStatus.Draft;
               t.UsageCount = count;
            }
            
            status = "success";
            message = "Templates fetched successfully.";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message,e);
        }

        return (status, message, templatesList);
    }

    public int TemplatesCount(string templateOwner)
    {
        return DbContext.Template.Count(t => t.TemplateOwner.ToString() == templateOwner);
    }

    public (string status, string message, Template template) GetTemplateDetails(int templateId)
    {
        var status = "error";
        var message = "Error occurred while fetching template details.";
        var templateDetails = new Template();
        try
        {
             templateDetails = DbContext.Template
                .Where(t => t.TemplateId ==  templateId)
                .Include(t => t.Users) // Template owner/user
                .Include(t => t.Documents)! // Include template documents
                .ThenInclude(d => d.TemplateRecipients)! // Include recipients for each document
                .ThenInclude(tr => tr.TemplateRecipientField) // Include fields for each recipient
                .Include(t => t.Documents)! 
                .ThenInclude(d => d.TemplateDocumentFiles)! // Include document files
                .ThenInclude(f => f.File) // Include the actual file resource
                .FirstOrDefault(); 
             status = "success";
             message = "Template details retrieved successfully.";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message, templateDetails!);
    }

    public (string status,string message, TemplateDetailsDto? templateDetailsDto) GetTemplateDetailsDto(int templateId)
    {
        var status = "error";
        var message = "Error occurred while fetching template details.";
        TemplateDetailsDto? dto = null;
        try
        {
            dto = DbContext.Template
                .AsNoTracking()
                .Where(t => t.TemplateId == templateId)
                .Select(t => new TemplateDetailsDto
                {
                    TemplateId = t.TemplateId,
                    TemplateName = t.TemplateName,
                    Description = t.Description,
                    CreatedOn = t.CreatedOn,
                    IsSequentialSigningEnabled = t.IsSequentialSigningEnabled,
                    Owner = t.Users != null
                        ? new TemplateOwnerDto
                        {
                            UserId = t.Users.UserId,
                            Name = (t.Users.Fname + " " + t.Users.Lname).Trim(),
                            Email = t.Users.Email,
                            Role = t.Users.UserRole
                        }
                        : DbContext.Users
                            .Where(u => u.UserId == t.TemplateOwner)
                            .Select(u => new TemplateOwnerDto
                            {
                                UserId = u.UserId,
                                Name = (u.Fname + " " + u.Lname).Trim(),
                                Email = u.Email,
                                Role = u.UserRole
                            })
                            .FirstOrDefault(),
                    Documents = t.Documents.Select(d => new TemplateDocumentDto
                    {
                        DocumentId = d.DocumentId,
                        TemplateId = d.TemplateId,
                        Title = d.Title,
                        UploadedAt = d.UploadedAt,
                        Files = d.TemplateDocumentFiles.Select(df => new TemplateDocumentFileDto
                        {
                            Id = df.Id,
                            FileResourceId = df.FileResourceId,
                            FileName = df.File != null ? df.File.ResourceName : null,
                            FileType = df.File != null ? df.File.FileType.ToString() : null,
                            FileSizeBytes = df.File != null ? df.File.ResourceSizeBytes : null
                        }).ToList(),
                        Recipients = d.TemplateRecipients.Select(r => new TemplateRecipientDto
                        {
                            TemplateRecipientId = r.TemplateRecipientId,
                            RecipientRoleId = r.RecipientRoleId,
                            RecipientRoleName = r.RecipientRole != null ? r.RecipientRole.Role : null,
                            DefaultUserId = r.DefaultUserId,
                            DefaultUserName = r.DefaultUser != null ? (r.DefaultUser.Fname + " " + r.DefaultUser.Lname).Trim() : null,
                            DefaultUserEmail = r.DefaultUser != null ? r.DefaultUser.Email : null,
                            DeliveryType = r.DeliveryType.ToString(),
                            Message = r.Message,
                            // Filter: when sequential signing ENABLED -> exclude common fields; when DISABLED -> include all.
                            // Restructured to a single Where for better EF translation (previous ternary caused translation failure).
                            Fields = r.TemplateRecipientField
                                .Where(trf => !trf.IsCommonField) // exclude common from per-recipient list
                                .Select(trf => new TemplateRecipientFieldDto
                                {
                                    RecipientFieldId = trf.RecipientFieldId,
                                    FieldId = trf.FieldId,
                                    FieldType = trf.Field.FieldType,
                                    FieldName = trf.Field.FieldName,
                                    FieldPosition = trf.Field.FieldPosition,
                                    IsRequired = trf.Field.IsRequired,
                                    IsCommonField = trf.IsCommonField
                                }).ToList()
                        }).ToList()
                    }).ToList(),
                    // Extended metrics provisional initialization; will be finalized after materialization
                    UsageCount = 0,
                    DistinctRecipientRoles = 0,
                    DistinctFileTypes = 0,
                    AvgFieldsPerRecipient = 0,
                    TotalFileSizeBytes = 0
                })
                .FirstOrDefault();
            if (dto != null)
            {
                dto.TotalRecipients = dto.Documents.Sum(d => d.Recipients.Count);
                // Build common fields once per document (aggregate unique common field definitions)
                foreach (var doc in dto.Documents)
                {
                    var commonGroups = new Dictionary<int, TemplateCommonFieldDto>();
                    foreach (var recip in doc.Recipients)
                    {
                        // We intentionally scanned original entity sets above; need to re-query for common fields per document recipients
                        // Since EF materialized r.TemplateRecipientField already, we can derive common from union of all recipients.
                        // Add a safe null check; if repository changes to lazy or uninitialized collections we avoid null reference.
                        if (recip.Fields == null) continue;
                    }
                    // Secondary extraction: we must pull common fields from underlying entities; re-query DbContext for this document
                    var commonRaw = DbContext.Set<TemplateDocument>()
                        .Where(td => td.DocumentId == doc.DocumentId)
                        .SelectMany(td => td.TemplateRecipients.SelectMany(tr => tr.TemplateRecipientField))
                        .Where(f => f.IsCommonField)
                        .Select(f => new TemplateCommonFieldDto
                        {
                            FieldId = f.FieldId,
                            FieldType = f.Field.FieldType,
                            FieldName = f.Field.FieldName,
                            FieldPosition = f.Field.FieldPosition,
                            IsRequired = f.Field.IsRequired
                        })
                        .ToList();
                    foreach (var cf in commonRaw)
                    {
                        if (!commonGroups.ContainsKey(cf.FieldId))
                            commonGroups[cf.FieldId] = cf;
                    }
                    doc.CommonFields = commonGroups.Values.ToList();
                }
                dto.TotalFields = dto.Documents.Sum(d => d.Recipients.Sum(r => r.Fields.Count) + d.CommonFields.Count);
                dto.TotalFiles = dto.Documents.Sum(d => d.Files.Count);
                dto.DistinctRecipientRoles = dto.Documents.SelectMany(d => d.Recipients).Select(r => r.RecipientRoleName).Where(rn => rn != null).Distinct().Count();
                dto.DistinctFileTypes = dto.Documents.SelectMany(d => d.Files).Select(f => f.FileType).Where(ft => ft != null).Distinct().Count();
                dto.TotalFileSizeBytes = dto.Documents.SelectMany(d => d.Files).Sum(f => f.FileSizeBytes ?? 0);
                var totalRecipients = dto.TotalRecipients;
                dto.AvgFieldsPerRecipient = totalRecipients == 0 ? 0 : Math.Round(dto.TotalFields / (double)totalRecipients, 2);
                // Usage count: number of workflow summaries referencing this template
                try
                {
                    // Assuming a Workflow table or summary exists; fallback to 0 if not mapped
                    var usageCount = DbContext.Set<WorkflowSummaryDto>().Count(w => w.TemplateId == dto.TemplateId);
                    dto.UsageCount = usageCount;
                }
                catch
                {
                    dto.UsageCount = 0;
                }
            }
            status = "success";
            message = dto == null ? "Template not found" : "Template details retrieved successfully.";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message, dto);
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

    public (string status, string message, List<TemplateRecipient> templateRecipientsList) GetTemplateRecipientsList( int templateId)
    {
        var status = "error";
        var message = "Error occured while fetching template Recipients";
        var templateRecipientsList = new List<TemplateRecipient>();
        try
        {
            templateRecipientsList = DbContext.TemplateRecipient
                .Where(tr => tr.TemplateDocument.TemplateId == templateId)
                .Include(tr => tr.RecipientRole)
                .Include(tr => tr.DefaultUser)
                .Include(tr => tr.TemplateRecipientField)
                    .ThenInclude(trf => trf.Field)
                .ToList();
 
            status = "success";
            message = "Template Recipients fetched successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message,e);
        }
        return (status,message,templateRecipientsList);
    }

    public (string status, string message, Template? template) GetTemplateForOwner(int templateId, Guid ownerId)
    {
        var status = "error";
        var message = "Error occurred while fetching template";
        Template? template = null;
        try
        {
            template = DbContext.Template.FirstOrDefault(t => t.TemplateId == templateId && t.TemplateOwner == ownerId);
            status = "success";
            message = template == null ? "Template not found" : "Template fetched";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message, template);
    }

    public (string status, string message, List<(int workflowId, string? workflowName, WorkflowStatus status)> workflows) GetTemplateWorkflowReferences(int templateId)
    {
        var status = "error";
        var message = "Error occurred while fetching workflow references";
        var wfList = new List<(int workflowId, string? workflowName, WorkflowStatus status)>();
        try
        {
            wfList = DbContext.Workflow
                .Where(w => w.TemplateId == templateId)
                .Select(w => new { w.WorkFlowId, w.WorkflowName, w.Status })
                .AsEnumerable()
                .Select(w => (w.WorkFlowId, w.WorkflowName, w.Status))
                .ToList();
            status = "success";
            message = "Workflow references fetched";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message, wfList);
    }
}