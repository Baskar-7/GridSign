using GridSign.Models.DTOs.RequestDTO;
using GridSign.Models.Entities;
using GridSign.Services.Interfaces;
using Microsoft.AspNetCore.Authorization; 
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;

namespace GridSign.Controllers;

[Route("api/workflow")]
[ApiController]
public class SigningWorkflowController(ISigningWorkflowService signingWorkflowService) : ControllerBase
{
    [HttpPost("createWorkflow")]
    [Authorize(Roles = "User")]
    public async Task<IActionResult> CreateWorkflow(IFormFile document,[FromForm]CreateWorkFlowDto workflowDto)
    {
        if (workflowDto.RecipientConfiguration != RecipientConfiguration.FromTemplate)
        {
            if (!string.IsNullOrEmpty(Request.Form["recipients"]))
                workflowDto.Recipients = JsonConvert.DeserializeObject<List<RecipientDto>>(Request.Form["recipients"]!);

            if (workflowDto.RecipientConfiguration == RecipientConfiguration.CreateNewTemplate && !string.IsNullOrEmpty(Request.Form["commonFields"]))
                workflowDto.CommonFields = JsonConvert.DeserializeObject<List<FieldDto>>(Request.Form["commonFields"]!);
        }
        
        var apiResponse =await signingWorkflowService.CreateWorkFlow(workflowDto,document);
        return Ok(apiResponse);
    } 
    
    [HttpPost("getWorkflows")]
    [Authorize(Roles = "User")]
    public IActionResult GetWorkflows([FromBody]GetWorkflowsDto  requestDto)
    {
        var response = signingWorkflowService.GetWorkflows(requestDto);
        return Ok(response);
    }

    [HttpPost("getSignForms")]
    [Authorize(Roles = "User")]
    public IActionResult GetSignForms([FromBody]GetSignFormsRequestDto requestDto)
    {
        var response = signingWorkflowService.GetSignForms(requestDto);
        return Ok(response);
    }

    [HttpPost("resendEnvelope")]
    [Authorize(Roles = "User")]
    public async Task<IActionResult> ResendEnvelope([FromBody] int envelopeId)
    {
        if (envelopeId <= 0) return BadRequest("Invalid envelope id");
        var response = await signingWorkflowService.ResendEnvelopeAsync(envelopeId);
        return Ok(response);
    }

    [HttpGet("signForm/details")]
    [Authorize(Roles = "User")]
    public IActionResult GetSignFormDetails([FromQuery] int envelopeId)
    {
        if (envelopeId <= 0) return BadRequest("Invalid envelope id");
        var response = signingWorkflowService.GetSignFormDetails(envelopeId);
        return Ok(response);
    }
    
    [HttpGet("getWorkflowsDetails")]
    [Authorize(Roles = "User")]
    public IActionResult GetWorkflowsDetails([FromQuery]int workflowId)
    {
        var response = signingWorkflowService.GetWorkflowDetails(workflowId);
        return Ok(response);
    }
     
    [HttpPatch("updateWorkflow")]
    [Authorize(Roles = "User")]
    public async Task<IActionResult> UpdateWorkflow([FromBody]UpdateWorkflowDto updateWorkflowDto)
    {
        var updateResponse = await signingWorkflowService.UpdateWorkflowDetails(updateWorkflowDto);
        return Ok(updateResponse);
    }
    
    [HttpPost("completeSigning")]
    [Authorize(Roles = "User")]   
    public async Task<IActionResult> CompleteSigning(IFormFile signedDocument, [FromForm]CompleteSigningReqDto signingReqDto)
    {
        var apiResponse = await signingWorkflowService.CompleteDocumentSigningAsync(signingReqDto,signedDocument);
        return Ok(apiResponse);
    } 
    
    [HttpPost("addRecipientRole")]
    [Authorize(Roles = "User")]
    public IActionResult AddRecipientRole([FromBody]TemplateRecipientRole role)
    {
        var apiResponse =  signingWorkflowService.AddRolesToWorkflow(role);
        return Ok(apiResponse);
    }
    
    [HttpGet("getRecipientRoles")]
    [Authorize(Roles = "User")]
    public IActionResult GetRoles()
    {
        var apiResponse = signingWorkflowService.GetRolesList();
        return Ok(apiResponse);
    }
    
    [HttpGet("getProgress")]
    [Authorize(Roles = "User")]
    public IActionResult GetProgress([FromQuery]int workflowId)
    {
        var apiResponse = signingWorkflowService.GetWorkflowProgress(workflowId);
        return Ok(apiResponse);
    }

    // Unified endpoint to start or cancel a workflow
    // POST api/workflow/action
    [HttpPost("action")]
    [Authorize(Roles = "User")]
    public async Task<IActionResult> WorkflowAction([FromBody] WorkflowActionRequestDto request)
    {
        if (request is not { WorkflowId: > 0 })
            return BadRequest("Invalid workflow action request.");

        switch (request.Action)
        {
            case WorkflowActionType.Start:
                    var startResult = await signingWorkflowService.StartWorkflowAsync(request.WorkflowId, request.AutoReminder, request.ReminderIntervalDays);
                return Ok(startResult);
            case WorkflowActionType.Cancel: 
                var cancelResult = await signingWorkflowService.CancelWorkflowAsync(request.WorkflowId, null);
                return Ok(cancelResult);
            default:
                return BadRequest("Unsupported workflow action.");
        }
    }
    
    // Sends reminder emails to all pending recipients of an active workflow (bulk operation)
    [HttpPost("remind-all")]
    [Authorize(Roles = "User")]
    public async Task<IActionResult> RemindAll([FromBody] RemindAllWorkflowRequestDto request)
    {
        if (request is not { WorkflowId: > 0 }) return BadRequest("Invalid remind workflow request.");
        var result = await signingWorkflowService.RemindWorkflowAsync(request.WorkflowId);
        return Ok(result);
    }

    // Sends a reminder email to a single recipient (if pending)
    [HttpPost("remind-recipient")]
    [Authorize(Roles = "User")]
    public async Task<IActionResult> RemindRecipient([FromBody] RemindRecipientRequestDto request)
    {
        if (request is not { RecipientId: > 0 }) return BadRequest("Invalid recipient id");
        var result = await signingWorkflowService.RemindRecipientAsync(request.RecipientId);
        return Ok(result);
    }

    // Deletes a workflow if allowed (Draft, Completed, Cancelled)
    [HttpDelete("delete")]
    [Authorize(Roles = "User")]
    public async Task<IActionResult> DeleteWorkflow([FromQuery] int workflowId)
    {
        if (workflowId <= 0) return BadRequest("Invalid workflow id");
        var result = await signingWorkflowService.DeleteWorkflowAsync(workflowId);
        return Ok(result);
    }
      
}