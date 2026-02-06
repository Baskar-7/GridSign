using GridSign.Models.Entities;
using GridSign.Models.DTOs.RequestDTO; // Added for DeliveryType enum reference
using System.Collections.Generic;

namespace GridSign.Models.DTOs.ResponseDTO;

public class SignFormFieldDto
{
    public int FieldId { get; set; }
    public string? FieldType { get; set; }
    public string? FieldName { get; set; }
    public string? Position { get; set; }
    public bool IsRequired { get; set; }
    // Added for per-recipient field association in signing details response
    public int? TemplateRecipientId { get; set; }
}

public class SignFormRecipientDetailsDto
{
    public int WorkflowRecipientId { get; set; }
    public int TemplateRecipientId { get; set; }
    public string? Name { get; set; }
    public string? Email { get; set; }
    public string? RoleName { get; set; }
    public int RolePriority { get; set; }
    public DeliveryType DeliveryType { get; set; }
    public bool UseDefaultUser { get; set; }
    public string EnvelopeStatus { get; set; } = "";
    public bool IsCurrentSigner { get; set; }
    // New: include recipient-specific fields directly for richer client UI
    public List<SignFormFieldDto> Fields { get; set; } = new();
}

public class SignFormSigningDetailsDto
{
    public int EnvelopeId { get; set; }
    public int WorkflowId { get; set; }
    public int? TemplateId { get; set; }
    public string? WorkflowName { get; set; }
    public string? DocumentName { get; set; }
    public string? RequesterName { get; set; }
    public string? RequesterEmail { get; set; }
    public string EnvelopeStatus { get; set; } = "";
    public string WorkflowStatus { get; set; } = "";
    public DateOnly? ValidUntil { get; set; }
    public bool IsSequentialSigningEnabled { get; set; }
    public bool IsExpired { get; set; }
    public bool AlreadySigned { get; set; }
    public bool CanSign { get; set; }
    // New: include a one-time signing token for the current signer (if available)
    public string? Token { get; set; }
    public List<SignFormRecipientDetailsDto> Recipients { get; set; } = new();
    public List<SignFormFieldDto> Fields { get; set; } = new();
}
