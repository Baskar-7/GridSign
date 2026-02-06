using GridSign.Models.DTOs.ResponseDTO;
using GridSign.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace GridSign.Controllers;

[Route("api/reports")]
[ApiController]
public class ReportsController(IReportsService reportsService) : ControllerBase
{

    [HttpGet("extended")]
    [Authorize(Roles = "User")]
    public IActionResult GetExtended([FromQuery] string? dateRange = null)
    {
        var apiResponse = reportsService.GetExtendedReport(dateRange);
        return Ok(apiResponse);
    }


    [HttpGet("sidebar")]
    [Authorize(Roles = "User")]
    public IActionResult GetSidebar([FromQuery] int expiringDays = 14, [FromQuery] int expiringLimit = 8)
    {
        var apiResponse = reportsService.GetSidebarReport(expiringDays, expiringLimit);
        return Ok(apiResponse);
    }
}
