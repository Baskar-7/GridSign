using AutoMapper;
using GridSign.Models.DTOs.RequestDTO;
using GridSign.Models.DTOs.ResponseDTO;
using GridSign.Models.Entities;

namespace GridSign.Mapper;

public class AutoMappers : Profile
{
    public AutoMappers()
    {
        CreateMap<Users, UserProfileDto>()
            .ForMember(d => d.ProfilePicFileResourceId, o => o.MapFrom(s => s.ProfilePicId))
            .ForMember(d => d.PendingEmail, o => o.MapFrom(s => s.PendingEmail))
            .ForMember(d => d.IsMailVerified, o => o.MapFrom(s => s.IsMailVerified));
        CreateMap<Template, TemplatesResponseDto>()
            .ForMember(dest => dest.TemplateOwner, opt => opt.MapFrom(src =>
                src.Users != null
                    ? (src.Users.Fname + " " + src.Users.Lname).Trim()
                    : src.TemplateOwner.ToString()
            ));
        CreateMap<CreateTemplateDto, CreateWorkFlowDto>().ReverseMap();
        CreateMap<Workflow, WorkflowSummaryDto>()
            .ForMember(dest => dest.WorkFlowCreatorId, opt => opt.MapFrom(src => src.WorkFlowCreator))
            .ForMember(dest => dest.WorkflowOwnerName, opt => opt.MapFrom(src => src.User != null ? (src.User.Fname + " " + src.User.Lname).Trim() : string.Empty))
            .ForMember(dest => dest.WorkflowName, opt => opt.MapFrom(src => src.WorkflowName))
            .ForMember(dest => dest.TemplateName, opt => opt.MapFrom(src => src.Template != null ? src.Template.TemplateName : string.Empty))
            .ForMember(dest => dest.IsSequentialSigningEnabled, opt => opt.MapFrom(src => src.Template != null && src.Template.IsSequentialSigningEnabled))
            .ForMember(dest => dest.TemplateId, opt => opt.MapFrom(src => src.Template != null ? src.Template.TemplateId : src.TemplateId));

        CreateMap<Workflow, ExpiringWorkflowDto>()
            .ForMember(dest => dest.WorkflowId, opt => opt.MapFrom(src => src.WorkFlowId))
            .ForMember(dest => dest.WorkflowName, opt => opt.MapFrom(src => src.WorkflowName ?? ("Workflow " + src.WorkFlowId)))
            .ForMember(dest => dest.ValidUntil, opt => opt.MapFrom(src => src.ValidUntil.ToDateTime(TimeOnly.MinValue)))
            .ForMember(dest => dest.TemplateId, opt => opt.MapFrom(src => src.TemplateId))
            .ForMember(dest => dest.TemplateName, opt => opt.MapFrom(src => src.Template != null ? src.Template.TemplateName : string.Empty))
            .ForMember(dest => dest.DaysRemaining, opt => opt.Ignore()) // computed after mapping
            .AfterMap((src, dest) => {
                dest.DaysRemaining = (int)Math.Ceiling((dest.ValidUntil.Date - DateTime.UtcNow.Date).TotalDays);
            });

        // Sign form field mapping (TemplateRecipientField -> SignFormFieldDto)
        CreateMap<TemplateRecipientField, SignFormFieldDto>()
            .ForMember(dest => dest.FieldId, opt => opt.MapFrom(src => src.Field.FieldId))
            .ForMember(dest => dest.FieldType, opt => opt.MapFrom(src => src.Field.FieldType))
            .ForMember(dest => dest.FieldName, opt => opt.MapFrom(src => src.Field.FieldName))
            .ForMember(dest => dest.Position, opt => opt.MapFrom(src => src.Field.FieldPosition))
            .ForMember(dest => dest.IsRequired, opt => opt.MapFrom(src => src.Field.IsRequired))
            .ForMember(dest => dest.TemplateRecipientId, opt => opt.MapFrom(src => src.RecipientId));

        // Workflow details mappings
        CreateMap<Workflow, WorkflowDetailsDto>()
            .ForMember(d => d.WorkFlowId, o => o.MapFrom(s => s.WorkFlowId))
            .ForMember(d => d.WorkflowName, o => o.MapFrom(s => s.WorkflowName))
            .ForMember(d => d.WorkFlowCreatorId, o => o.MapFrom(s => s.WorkFlowCreator))
            .ForMember(d => d.WorkflowOwnerName, o => o.MapFrom(s => s.User != null ? (s.User.Fname + " " + s.User.Lname).Trim() : null))
            .ForMember(d => d.WorkflowOwnerEmail, o => o.MapFrom(s => s.User != null ? s.User.Email : null))
            .ForMember(d => d.Status, o => o.MapFrom(s => s.Status))
            .ForMember(d => d.RecipientConfiguration, o => o.MapFrom(s => s.RecipientConfiguration))
            .ForMember(d => d.ValidUntil, o => o.MapFrom(s => s.ValidUntil))
            .ForMember(d => d.ReminderIntervalInDays, o => o.MapFrom(s => s.ReminderIntervalInDays))
            .ForMember(d => d.TemplateId, o => o.MapFrom(s => s.TemplateId))
            .ForMember(d => d.TemplateName, o => o.MapFrom(s => s.Template != null ? s.Template.TemplateName : null))
            .ForMember(d => d.TemplateDescription, o => o.MapFrom(s => s.Template != null ? s.Template.Description : null))
            .ForMember(d => d.TemplateCreatedOn, o => o.MapFrom(s => s.Template != null ? s.Template.CreatedOn : (DateTime?)null))
            .ForMember(d => d.IsSequentialSigningEnabled, o => o.MapFrom(s => s.Template != null && s.Template.IsSequentialSigningEnabled))
            .ForMember(d => d.CreatedAtUtc, o => o.MapFrom(s => s.CreatedOn))
            .ForMember(d => d.LastUpdatedUtc, o => o.MapFrom(s => s.LastUpdatedDate))
            .ForMember(d => d.Recipients, o => o.Ignore())
            .ForMember(d => d.Documents, o => o.Ignore())
            .ForMember(d => d.Progress, o => o.Ignore());

        CreateMap<WorkflowRecipientSignature, WorkflowRecipientSignatureDetailsDto>()
            .ForMember(d => d.RecipientSignatureId, o => o.MapFrom(s => s.RecipientSignatureId))
            .ForMember(d => d.IsSigned, o => o.MapFrom(s => s.IsSigned))
            .ForMember(d => d.SignedAt, o => o.MapFrom(s => s.SignedAt))
            .ForMember(d => d.SignedDocumentId, o => o.MapFrom(s => s.WorkflowRecipientSignedDocument.SignedDocumentId))
            .ForMember(d => d.LatestVersionNumber, o => o.Ignore())
            .ForMember(d => d.Versions, o => o.Ignore());

        CreateMap<SignedDocumentVersion, SignedDocumentVersionDto>()
            .ForMember(d => d.SignedDocumentVersionId, o => o.MapFrom(s => s.SignedDocumentVersionId))
            .ForMember(d => d.VersionNumber, o => o.MapFrom(s => s.VersionNumber))
            .ForMember(d => d.CreatedAt, o => o.MapFrom(s => s.CreatedAt))
            .ForMember(d => d.FileResourceId, o => o.MapFrom(s => s.FileResourceId));

        CreateMap<WorkflowRecipientSignedDocument, SignedDocumentDetailsDto>()
            .ForMember(d => d.SignedDocumentId, o => o.MapFrom(s => s.SignedDocumentId))
            .ForMember(d => d.IsSharedDocument, o => o.MapFrom(s => s.IsSharedDocument))
            .ForMember(d => d.LatestVersionNumber, o => o.Ignore())
            .ForMember(d => d.Versions, o => o.Ignore());

        CreateMap<WorkflowRecipient, WorkflowRecipientDetailsDto>()
            .ForMember(d => d.WorkflowRecipientId, o => o.MapFrom(s => s.WorkflowRecipientId))
            .ForMember(d => d.DisplayName, o => o.Ignore())
            .ForMember(d => d.Email, o => o.Ignore())
            .ForMember(d => d.UseDefaultUser, o => o.MapFrom(s => s.UseDefaultUser))
            .ForMember(d => d.TemplateRecipientId, o => o.MapFrom(s => s.TemplateRecipientId))
            .ForMember(d => d.CustomUserId, o => o.MapFrom(s => s.CustomUser))
            .ForMember(d => d.ResolvedUserName, o => o.Ignore())
            .ForMember(d => d.ResolvedUserEmail, o => o.Ignore())
            .ForMember(d => d.RecipientRoleId, o => o.MapFrom(s => s.TemplateRecipient != null ? s.TemplateRecipient.RecipientRole!.RoleId : (int?)null))
            .ForMember(d => d.RecipientRoleName, o => o.MapFrom(s => s.TemplateRecipient != null ? s.TemplateRecipient.RecipientRole!.Role : null))
            .ForMember(d => d.RecipientRolePriority, o => o.MapFrom(s => s.TemplateRecipient != null ? s.TemplateRecipient.RecipientRole!.RolePriority : (int?)null))
            .ForMember(d => d.DeliveryType, o => o.MapFrom(s => (int)(s.TemplateRecipient != null ? s.TemplateRecipient.DeliveryType : 0)))
            .ForMember(d => d.EnvelopeStatus, o => o.Ignore())
            .ForMember(d => d.EnvelopeSentAt, o => o.Ignore())
            .ForMember(d => d.EnvelopeCompletedAt, o => o.Ignore())
            .ForMember(d => d.HasSigned, o => o.Ignore())
            .ForMember(d => d.Signatures, o => o.Ignore());

        // Workflow progress snapshot base mapping (computes simple scalar fields; collections & percentages populated after mapping)
        CreateMap<Workflow, WorkflowProgressDto>()
            .ForMember(d => d.WorkflowId, o => o.MapFrom(s => s.WorkFlowId))
            .ForMember(d => d.OverallStatus, o => o.MapFrom(s => s.Status.ToString()))
            .ForMember(d => d.LastUpdatedUtc, o => o.MapFrom(_ => DateTime.UtcNow))
            .ForMember(d => d.Envelopes, o => o.Ignore())
            .ForMember(d => d.Recipients, o => o.Ignore())
            .ForMember(d => d.Signatures, o => o.Ignore())
            .ForMember(d => d.Percentages, o => o.Ignore());
        
    }
}