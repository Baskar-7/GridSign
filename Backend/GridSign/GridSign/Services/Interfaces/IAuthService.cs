using GridSign.Models.DTOs.RequestDTO;
using GridSign.Models.DTOs.ResponseDTO;
using GridSign.Models.Entities;

namespace GridSign.Services.Interfaces;

public interface IAuthService
{
     
     ApiResponse<AuthResponseDTO> AuthenticateUser(SignInReqDto user);
     ApiResponse<AuthResponseDTO> GoogleAuthenticateUser(GoogleSignInRequestDto user);
     
     Task<ApiResponse<AuthResponseDTO>> SendOtp(SendOtpReqDto user);
     
     Task<ApiResponse<AuthResponseDTO>> SendResetPasswordLink(SendOtpReqDto sendResetPassDto);
     
     ApiResponse<AuthResponseDTO> UpdatePassword(PasswordChangeDto passwordChangeDto);
     ApiResponse<object> IsValidResetPassUrl(ResetPassLinkCheckDto linkCheckDto);
}