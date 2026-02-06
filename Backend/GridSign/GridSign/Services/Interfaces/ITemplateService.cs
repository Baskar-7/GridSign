using GridSign.Models.DTOs.CommonDTO;
using GridSign.Models.DTOs.RequestDTO;
using GridSign.Models.DTOs.ResponseDTO;
using GridSign.Models.Entities;

namespace GridSign.Services.Interfaces;

public interface ITemplateService
{
    ApiResponse<BasePagedResponseDto<TemplatesResponseDto>> GetTemplateList(GetTemplatesDto templatesDto); 
    Task<(string status, string message, int? templateId)> CreateTemplate(string templateOwner, CreateTemplateDto createTemplateDto, IFormFile document);
    Task<ApiResponse<object>> CreateTemplate(CreateTemplateDto createTemplateDto, IFormFile document);
    ApiResponse<TemplateDetailsDto> GetTemplateDetails(int templateId);
    ApiResponse<object> DeleteTemplate(int templateId);
}