using GridSign.Models.DTOs.RequestDTO;
using GridSign.Models.DTOs.ResponseDTO;
using GridSign.Models.Entities;

namespace GridSign.Services.Interfaces;

public interface IUserService
{
    ApiResponse<AuthResponseDTO> RegisterUser(SignupRequestDto user);
    ApiResponse<object> UpdateUser(UserUpdateDto user);
    ApiResponse<UserProfileDto> GetUserDetails();
    Users GetOrCreateUser(string email, string name);
    Task<ApiResponse<UserProfileDto>> UpdateProfilePic(IFormFile picture);
    ApiResponse<object> RequestEmailChange(string newEmail);
    ApiResponse<object> VerifyEmailChange(Guid userId,string token);
}