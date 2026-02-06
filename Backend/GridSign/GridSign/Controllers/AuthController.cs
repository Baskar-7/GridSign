using GridSign.Models.DTOs.RequestDTO; 
using GridSign.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;

namespace GridSign.Controllers;
using Microsoft.AspNetCore.Mvc;

[Route("api/auth")]
[ApiController]
public class AuthController(IAuthService authService,IUserService userService) : ControllerBase
{ 
    [HttpPost("signup")]
    [AllowAnonymous]
    public IActionResult RegisterUser([FromBody]SignupRequestDto user)
    {
        var apiResponse = userService.RegisterUser(user);
        return Ok(apiResponse);
    }
    
    [HttpPost("signin")]
    [AllowAnonymous]
    public IActionResult LoginUser([FromBody]SignInReqDto user)
    {
        var signInResponse = authService.AuthenticateUser(user);
        return Ok(signInResponse);
    }
    
    [HttpPost("google-signin")]
    [AllowAnonymous]
    public IActionResult GoogleLoginUser([FromBody]GoogleSignInRequestDto user)
    {
        var gSignInResponse = authService.GoogleAuthenticateUser(user);
        return Ok(gSignInResponse);
    }
    
    [HttpPost("send-otp")]
    [AllowAnonymous]
    public async Task<IActionResult> SendOneTimePassword([FromBody]SendOtpReqDto sendOtpReq)
    {
        var sendOtpResponse = await authService.SendOtp(sendOtpReq);
        return Ok(sendOtpResponse);
    }

    [HttpPost("request-password-reset")]
    [AllowAnonymous]
    public async Task<IActionResult> SendResetPasswordLink([FromBody]SendOtpReqDto sendResetPassDto)
    {
        var resetPassLinkRes = await authService.SendResetPasswordLink(sendResetPassDto);
        return Ok(resetPassLinkRes);
    }
    
    [HttpPost("reset-password")]
    [AllowAnonymous]
    public IActionResult ResetPassword([FromBody] PasswordChangeDto passwordDto)
    {
        var updatePasswordResponse = authService.UpdatePassword(passwordDto);
        return Ok(updatePasswordResponse);
    }
    
    [HttpGet("check-url-validity")]
    [AllowAnonymous]
    public IActionResult IsValidResetPassUrl([FromQuery]ResetPassLinkCheckDto linkCheckDto)
    {
        var resetPassLinkRes = authService.IsValidResetPassUrl(linkCheckDto);
        return Ok(resetPassLinkRes);
    }
}
