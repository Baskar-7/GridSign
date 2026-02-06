using GridSign.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc; 

namespace GridSign.Controllers;

[Authorize]
[ApiController]
[Route("api/[controller]")]
public class FileResourceController(IFileResourceService fileResourceService) : ControllerBase
{

    [HttpGet("{id:int}")]
    [Authorize(Roles = "User")]
    public IActionResult GetFileResource(int id)
    {
        var apiResponse = fileResourceService.GetFileResourceById(id);
        if (apiResponse.Status.Equals("error") || apiResponse.Data?.ResourceData == null)
            return NotFound($"File resource {id} not found or empty.");

        // Prevent stale caching of frequently updated resources like profile pics
        Response.Headers.CacheControl = "no-store, must-revalidate";
        Response.Headers.Pragma = "no-cache";
        Response.Headers.Expires = "0";
        return File(apiResponse.Data.ResourceData, apiResponse.Data.ContentType, apiResponse.Data.FileName);
    }
}