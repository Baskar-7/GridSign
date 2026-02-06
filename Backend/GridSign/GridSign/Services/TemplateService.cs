using AutoMapper;
using GridSign.Helpers;
using GridSign.Models.DTOs.CommonDTO;
using GridSign.Models.Entities;
using GridSign.Services.Interfaces;
using GridSign.Models.DTOs.RequestDTO;
using GridSign.Models.DTOs.ResponseDTO;
using GridSign.Repositories.Templates.Interfaces;
using GridSign.Services.ServiceHelper;
using GridSign.Services.ServiceHelper.Interfaces; 

namespace GridSign.Services; 

public class TemplateService(ITemplateViewRepo viewRepo,ITemplateUpdateRepo updateRepo,IUserContext currUser,IUserService userService,IMapper autoMapper) : ServiceUtility,ITemplateService
{
    public async Task<ApiResponse<object>> CreateTemplate(CreateTemplateDto createTemplateDto,IFormFile document)
    {
        var apiResponse = new ApiResponse<object>();
        try
        {
            var currentUser = currUser.GetCurrentUser();
            if(currentUser == null)
                throw new Exception("User is not logged in..");
            
            var (isSuccess,transaction) = updateRepo.BeginTransaction();
            if (!isSuccess)
                throw new Exception("Transaction failed");

            await using (transaction)
            {
                try
                {
                    var templateResponse = await CreateTemplate(currentUser.UserId!, createTemplateDto, document);
                    apiResponse.Status = templateResponse.status;
                    apiResponse.Message = templateResponse.message;
                    await transaction.CommitAsync();
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
            Logger.Logg(LoggLevel.Error, e.Message,e);
        }
        return apiResponse;
    }
    
    public async Task<(string status,string message,int? templateId)> CreateTemplate(string templateOwner,CreateTemplateDto createTemplateDto,IFormFile document)
    {
         var status = "error";
         var message = "An error occured while trying to create a new template";
         int? templateId = null;
         try
         {
             // Create Template
            var template = new Template { TemplateOwner = new Guid(templateOwner),TemplateName = $"Template - {createTemplateDto.DocumentName}", Description = createTemplateDto.Description, CreatedOn = DateTime.Now, IsSequentialSigningEnabled = createTemplateDto.IsSequentialSigningEnabled};
            var (templateSts, templateMsg) = updateRepo.CreateTemplate(template);
            if (templateSts.Equals("error"))
                throw new Exception(templateMsg);
            
            templateId = template.TemplateId;

            // Create document with templateId
            var doc = new TemplateDocument { TemplateId = templateId.Value,Title = createTemplateDto.DocumentName,UploadedAt = DateTime.Now};
            var (docSts, docMsg) = updateRepo.CreateDocument(doc);
            if (docSts.Equals("error"))
                throw new Exception(docMsg);

            // Upload Master Document
            var fileBytes = await ConvertDocToBytes(document);
            var fileResource = new FileResource { ResourceData = fileBytes, ResourceName = createTemplateDto.DocumentName, FileType = FileResourceType.ToSignDoc, UploadedByUserId = new Guid(templateOwner), ResourceSizeBytes = fileBytes?.LongLength ?? 0 };
            var (frSts, frMsg) = updateRepo.CreateFileResource(fileResource);
            if (frSts.Equals("error"))
                throw new Exception(frMsg);

            // Link document
            var (linkSts, linkMsg) = updateRepo.SyncDocFilesToTemplateDocs(doc.DocumentId, fileResource.FileResourceId);
            if (linkSts.Equals("error"))
                throw new Exception(linkMsg);

            // Save Common Fields ONLY when sequential signing is DISABLED
            var commonFields = new List<Field>();
            if (!template.IsSequentialSigningEnabled && createTemplateDto.CommonFields is not null)
            {
                commonFields = CreateFields(createTemplateDto.CommonFields);
                var (fldSts, fldMsg) = updateRepo.CreateFieldList(commonFields);
                if (fldSts.Equals("error")) throw new Exception(fldMsg);
            }

            // Create Template Recipients
            var recipients = CreateTemplateRecipients(createTemplateDto.Recipients!, doc, createTemplateDto.RecipientMessage!, commonFields,template.IsSequentialSigningEnabled);
            if (recipients.Count <= 0)
                throw new Exception("Error occurred while creating Recipients");
            
            status = "success";
            message = "Template Created Successfully";
         }
         catch (Exception e)
         {
             Logger.Logg(LoggLevel.Error, e.Message,e);
         }
         return (status, message, templateId);
    }
    
    private static List<Field> CreateFields(List<FieldDto> recipientFields)
    {
        return
        [
            ..recipientFields.Select(fDto => new Field
            {
                FieldType = fDto.FieldType, FieldName = fDto.FieldName, FieldPosition = fDto.Position,
                IsRequired = fDto.IsRequired
            })
        ];
    }
    
    private List<TemplateRecipient> CreateTemplateRecipients(List<RecipientDto> templateRecipients, TemplateDocument templateDocument, string recipientMessage, List<Field> commonFields,bool isSequentialSigningEnabled)
    {
        var recipients = new List<TemplateRecipient>(); 
        foreach (var recipientDto in templateRecipients)
        {
            // Create recipient record
            var user = userService.GetOrCreateUser(recipientDto.Email!, recipientDto.Name!); 
            var recipient = CreateTemplateRecipientRecord(templateDocument, user, recipientDto, recipientMessage);
            recipients.Add(recipient);
            
            var templateRecipientFields = new List<TemplateRecipientField>();
            // Attach common fields only if sequential signing DISABLED (present in list)
            if (commonFields.Count > 0 && !isSequentialSigningEnabled)
            {
                var templateRecipientCommonFields = CreateTemplateRecipientFields(recipient.TemplateRecipientId,commonFields, true);
                templateRecipientFields.AddRange(templateRecipientCommonFields);
            }
 
            // Add recipient-specific fields
            if (recipientDto.Fields is not null)
            {
                var specificFields = CreateFields(recipientDto.Fields);
                var (fldSts, fldMsg) = updateRepo.CreateFieldList(specificFields);
                    if (fldSts.Equals("error")) throw new Exception(fldMsg);
                
                var templateRecipientSpecificFields = CreateTemplateRecipientFields(recipient.TemplateRecipientId, specificFields,false);
                templateRecipientFields.AddRange(templateRecipientSpecificFields);
            }

            var (linkSts,linkMsg) = updateRepo.AddRecipientFieldList(templateRecipientFields);
            if (linkSts.Equals("error"))
                throw new Exception(linkMsg);
        }
        return recipients;
    }

    private static List<TemplateRecipientField> CreateTemplateRecipientFields(int templateRecipientId,List<Field> recipientFields,bool isCommonField)
    {
        return
        [
            ..recipientFields.Select(recipientField => new TemplateRecipientField
            {
                RecipientId = templateRecipientId,
                FieldId = recipientField.FieldId,
                IsCommonField =  isCommonField
            })
        ];
    }
    
    private TemplateRecipient CreateTemplateRecipientRecord(TemplateDocument templateDocument,Users defaultUser , RecipientDto recipientDto, string recipientMsg)
    {
        //Check if the recipient role is valid
        var recipientRoleId = recipientDto.Role!.RoleId;
        if (!viewRepo.IsValidRecipientRole(recipientRoleId))
            throw new Exception($"RecipientRoleId {recipientDto.Role!.RoleId} does not exist.");
        
        //add a new recipient
        var recipient = new TemplateRecipient
        {
            DefaultUserId = defaultUser.UserId,
            TemplateDocumentId = templateDocument.DocumentId,
            DeliveryType = recipientDto.DeliveryType,
            Message = recipientMsg,
            RecipientRoleId = recipientRoleId
        };
        var (recSts, recMsg) = updateRepo.CreateTemplateRecipient(recipient);

        return recSts.Equals("error") ? throw new Exception(recMsg) : recipient;
    }
    
    public ApiResponse<BasePagedResponseDto<TemplatesResponseDto>> GetTemplateList(GetTemplatesDto templatesDto)
    {
        var apiResponse = new ApiResponse<BasePagedResponseDto<TemplatesResponseDto>>();
        try
        {
            var currentUser = currUser.GetCurrentUser();
            var (fetchSts,stsMsg,templateList) = viewRepo.GetAllTemplates(currentUser!.UserId!,templatesDto);
            var mappedItems = autoMapper.Map<List<TemplatesResponseDto>>(templateList);
 
            apiResponse.Data = new BasePagedResponseDto<TemplatesResponseDto>
            {
                Items = mappedItems,
                TotalCount = viewRepo.TemplatesCount(currentUser!.UserId!),
                PageNumber = templatesDto.PageNumber,
                PageSize = templatesDto.PageSize
            };
            apiResponse.Status = fetchSts;
            apiResponse.Message = stsMsg;
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message,e);
        }
        return apiResponse;
    }

    public ApiResponse<TemplateDetailsDto> GetTemplateDetails(int templateId)
    {
        var apiResponse = new ApiResponse<TemplateDetailsDto>();
        try
        {
            var (fetchSts, stsMsg, templateDetails) = viewRepo.GetTemplateDetailsDto(templateId);
            apiResponse.Data = templateDetails;
            apiResponse.Status = fetchSts;
            apiResponse.Message = stsMsg;
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return apiResponse;
    }

    public ApiResponse<object> DeleteTemplate(int templateId)
    {
        var apiResponse = new ApiResponse<object>();
        try
        {
            var currentUser = currUser.GetCurrentUser();
            if (currentUser == null)
                throw new Exception("User is not logged in.");
            // Ownership check via view repo
            var (_, _, template) = viewRepo.GetTemplateForOwner(templateId, new Guid(currentUser.UserId!));
            if (template == null)
                throw new Exception("Template not found or access denied.");

            // Workflow reference enumeration via view repo
            var (_, _, wfRefs) = viewRepo.GetTemplateWorkflowReferences(templateId);
            if (wfRefs.Count > 0)
            {
                apiResponse.Status = "blocked";
                apiResponse.Message = "Template is in use by existing workflows and cannot be deleted.";
                apiResponse.Data = new
                {
                    workflowCount = wfRefs.Count,
                    workflows = wfRefs.Select(w => new { w.workflowId, w.workflowName, status = w.status.ToString() }).ToList()
                };
                return apiResponse;
            }

            var (delSts, delMsg) = updateRepo.DeleteTemplate(templateId);
            apiResponse.Status = delSts;
            apiResponse.Message = delMsg;
        }
        catch (Exception e)
        {
            apiResponse.Message = e.Message;
        }
        return apiResponse;
    }
}