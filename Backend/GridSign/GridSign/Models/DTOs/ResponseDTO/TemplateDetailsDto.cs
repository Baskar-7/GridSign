using System.Collections.Generic;

namespace GridSign.Models.DTOs.ResponseDTO;

public class TemplateDetailsDto
{
    public int TemplateId { get; set; }
    public string? TemplateName { get; set; }
    public string? Description { get; set; }
    public DateTime? CreatedOn { get; set; }
    public bool IsSequentialSigningEnabled { get; set; }
    public TemplateOwnerDto? Owner { get; set; }
    public List<TemplateDocumentDto> Documents { get; set; } = new();
    public int TotalRecipients { get; set; }
    public int TotalFields { get; set; }
    public int TotalFiles { get; set; }
    // Extended metadata
    public int UsageCount { get; set; }
    public int DistinctRecipientRoles { get; set; }
    public int DistinctFileTypes { get; set; }
    public double AvgFieldsPerRecipient { get; set; }
    public long TotalFileSizeBytes { get; set; }
}

public class TemplateOwnerDto
{
    public Guid UserId { get; set; }
    public string? Name { get; set; }
    public string? Email { get; set; }
    public string? Role { get; set; }
}

public class TemplateDocumentDto
{
    public int DocumentId { get; set; }
    public int TemplateId { get; set; }
    public string? Title { get; set; }
    public DateTime UploadedAt { get; set; }
    public List<TemplateDocumentFileDto> Files { get; set; } = new();
    public List<TemplateRecipientDto> Recipients { get; set; } = new();
    // New: Common (shared) fields appear only once irrespective of recipient count
    public List<TemplateCommonFieldDto> CommonFields { get; set; } = new();
}

public class TemplateDocumentFileDto
{
    public int Id { get; set; }
    public int FileResourceId { get; set; }
    public string? FileName { get; set; }
    public string? FileType { get; set; }
    public long? FileSizeBytes { get; set; }
}

public class TemplateRecipientDto
{
    public int TemplateRecipientId { get; set; }
    public int RecipientRoleId { get; set; }
    public string? RecipientRoleName { get; set; }
    public Guid? DefaultUserId { get; set; }
    public string? DefaultUserName { get; set; }
    public string? DefaultUserEmail { get; set; }
    public string? DeliveryType { get; set; }
    public string? Message { get; set; }
    public List<TemplateRecipientFieldDto> Fields { get; set; } = new();
}

public class TemplateRecipientFieldDto
{
    public int RecipientFieldId { get; set; }
    public int FieldId { get; set; }
    public string? FieldType { get; set; }
    public string? FieldName { get; set; }
    public string? FieldPosition { get; set; }
    public bool IsRequired { get; set; }
    public bool IsCommonField { get; set; } // Indicates field shared across all recipients
}

public class TemplateCommonFieldDto
{
    public int FieldId { get; set; }
    public string? FieldType { get; set; }
    public string? FieldName { get; set; }
    public string? FieldPosition { get; set; }
    public bool IsRequired { get; set; }
}
