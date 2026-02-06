using Microsoft.AspNetCore.Mvc;
using GridSign.Services.Interfaces;
using GridSign.Models.DTOs.RequestDTO;
using Microsoft.AspNetCore.Authorization;
using Newtonsoft.Json;

namespace GridSign.Controllers;

[Route("api/template")]
[ApiController]
public class TemplateController(ITemplateService templateService) : ControllerBase
{
    [HttpPost("createTemplate")]
    [Authorize(Roles = "User")]
    public async Task<IActionResult> CreateTemplate([FromForm]CreateTemplateDto createTemplateDto,IFormFile document)
    {
        if (!string.IsNullOrEmpty(Request.Form["recipients"]))
            createTemplateDto.Recipients = JsonConvert.DeserializeObject<List<RecipientDto>>(Request.Form["recipients"]!);

        if (!string.IsNullOrEmpty(Request.Form["commonFields"]))
            createTemplateDto.CommonFields = JsonConvert.DeserializeObject<List<FieldDto>>(Request.Form["commonFields"]!);
        
        var createTemplateResponse = await templateService.CreateTemplate(createTemplateDto, document);
        return Ok(createTemplateResponse);
    }
    
    [HttpPost("getAllTemplates")]
    [Authorize(Roles = "User")]
    public IActionResult GetAllTemplates([FromBody]GetTemplatesDto templatesDto)
    {
        var templateResponse = templateService.GetTemplateList(templatesDto);
        return Ok(templateResponse);
    }

    [HttpGet("getTemplateDetails")]
    [Authorize(Roles = "User")]
    public IActionResult GetTemplateDetails([FromQuery] int templateId)
    {
        var templateDetails = templateService.GetTemplateDetails(templateId);
        return Ok(templateDetails);
    }

    [HttpDelete("{templateId}")]
    [Authorize(Roles = "User")]
    public IActionResult DeleteTemplate(int templateId)
    {
        var deleteResponse = templateService.DeleteTemplate(templateId);
        return Ok(deleteResponse);
    }
}