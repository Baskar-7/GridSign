using GridSign.Models.DTOs.RequestDTO; 
using GridSign.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;

namespace GridSign.Controllers;
using Microsoft.AspNetCore.Mvc;

[Route("api/user")]
[ApiController]
public class UserController(IUserService userService) : ControllerBase
{
    
    [HttpGet("getUserDetails")]
    [Authorize(Roles = "User")]
    public IActionResult GetUserDetails()
    {
        var resetPassLinkRes = userService.GetUserDetails();
        return Ok(resetPassLinkRes);
    }
    
    [HttpPatch("updateUserDetails")]
    [Authorize(Roles = "User")]
    public IActionResult UpdateUser([FromBody] UserUpdateDto user)
    {
        var apiResponse = userService.UpdateUser(user);
        return Ok(apiResponse);
    }
    
    [HttpPatch("updateProfilePicture")]
    [Authorize(Roles = "User")]
    public async Task<IActionResult> UpdateProfilePic(IFormFile picture)
    {
        var apiResponse = await userService.UpdateProfilePic(picture);
        return Ok(apiResponse);
    }

    [HttpPost("requestEmailChange")]
    [Authorize(Roles = "User")]
    public IActionResult RequestEmailChange([FromBody] EmailChangeRequestDto req)
    {
        var apiResponse = userService.RequestEmailChange(req.NewEmail);
        return Ok(apiResponse);
    }

    [HttpGet("verifyEmailChange")]
    [AllowAnonymous]
    public IActionResult VerifyEmailChange([FromQuery] Guid userId,[FromQuery] string token)
    {
        var apiResponse = userService.VerifyEmailChange(userId,token);
        return Ok(apiResponse);
    }
}