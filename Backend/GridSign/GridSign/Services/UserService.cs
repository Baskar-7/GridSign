using AutoMapper;
using GridSign.Helpers;
using GridSign.Models.DTOs.RequestDTO;
using GridSign.Models.DTOs.ResponseDTO;
using GridSign.Models.Entities;
using GridSign.Repositories.Auth;
using GridSign.Repositories.Auth.Interfaces;
using GridSign.Repositories.User.Interfcae;
using GridSign.Repositories.UserControl.Interfcae;
using GridSign.Services.Interfaces;
using GridSign.Services.ServiceHelper;
using GridSign.Services.ServiceHelper.Interfaces; 

namespace GridSign.Services;
public class UserService(IUserUpdateRepo updateRepo,IUserViewRepo viewRepo,IUserContext currUser,IMapper autoMapper,IAuthUpdateRepository authUpdateRepo,IAuthViewRepository authViewRepo) : ServiceUtility,IUserService
{
    public ApiResponse<AuthResponseDTO> RegisterUser(SignupRequestDto user)
    { 
        var response = new ApiResponse<AuthResponseDTO>();
        try
        {
            var (emailStatus, emailMessage, isDuplicateEmail,_) = viewRepo.IsDuplicateEmail(user.Email);
            if (isDuplicateEmail)
            {
                response.Status = emailStatus;
                response.Message = emailMessage;
                return response;
            }

            var (passwordHash,passwordSalt) = Hash(user.Password); 
            var userAcc = new Users
            {
                Fname = user.Fname,
                Lname = user.Lname,
                Email = user.Email,
                PasswordHash = passwordHash,
                PasswordSalt = passwordSalt,
                UserRole = "User"
            };
            var (addUserStatus, addUserMessage) = updateRepo.CreateUser(userAcc);
            if (addUserStatus.Equals("success"))
            { 
                response.Data = new AuthResponseDTO
                {
                    Token = GenerateJwtToken(user.Fname,user.Email, userAcc.UserId.ToString(),"User"),
                    Role = "User",
                    Username = $"{user.Fname} {user.Lname}",
                };
            }
            response.Status = addUserStatus;
            response.Message = addUserMessage;
        }
        catch (Exception e) {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return response;
    }
    
    public Users GetOrCreateUser(string email, string name)
    {
        var (userSts, _, userDetails) = viewRepo.GetUserDetailsWithEmail(email);
        if (userSts.Equals("success") && userDetails != null)
            return userDetails;

        var (passwordHash, passwordSalt) = Hash(email);
        var user = new Users
        {
            Fname = name, Lname = "User", PasswordHash = passwordHash, PasswordSalt = passwordSalt, Email = email,
            UserRole = "User"
        };
        var (createUserStatus, createUserMessage) = updateRepo.CreateUser(user);

        return createUserStatus.Equals("error") ? throw new Exception(createUserMessage) : user;
    }

    public async Task<ApiResponse<UserProfileDto>> UpdateProfilePic(IFormFile picture)
    {
        var apiResponse = new ApiResponse<UserProfileDto>();
        try
        {
            var currentUser = currUser.GetCurrentUser();
            if (currentUser == null)
                throw new Exception("User is not logged in..");

            if (picture == null || picture.Length == 0)
                throw new Exception("No file uploaded");

            const long maxSize = 2 * 1024 * 1024; // 2MB
            if (picture.Length > maxSize)
                throw new Exception("Image exceeds 2MB limit");

            var allowedTypes = new[] { "image/jpeg", "image/png", "image/webp" };
            if (!allowedTypes.Contains(picture.ContentType))
                throw new Exception("Unsupported image type. Allowed: JPEG, PNG, WEBP");

            var fileBytes = await ConvertDocToBytes(picture);
            var updateResponse = updateRepo.UpdateUserProfilePic(new Guid(currentUser.UserId!), fileBytes);
            apiResponse.Status = updateResponse.status;
            apiResponse.Message = updateResponse.message;

            if (updateResponse.status == "success")
            {
                var userDetails = viewRepo.GetUserDetailsWithEmail(currentUser.Email!);
                if (userDetails.status == "success" && userDetails.user != null)
                {
                    var dto = autoMapper.Map<UserProfileDto>(userDetails.user);
                    apiResponse.Data = dto; // Frontend resolves image
                }
            }
        }
        catch (Exception e)
        {
            apiResponse.Status = "error";
            apiResponse.Message = e.Message;
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return apiResponse;
    }

    public ApiResponse<UserProfileDto> GetUserDetails()
    {
        var response = new ApiResponse<UserProfileDto>();
        try
        { 
            var currentUser = currUser.GetCurrentUser();
            if(currentUser == null)
                throw new Exception("User is not logged in..");
            
            var userDetails = viewRepo.GetUserDetailsWithUserId(new Guid(currentUser.UserId!));
            response.Status = userDetails.status;
            response.Message = userDetails.message;
            if (userDetails.status.Equals("error"))
                throw new Exception(userDetails.message);
            
            var dto = autoMapper.Map<UserProfileDto>(userDetails.user);
            response.Data = dto; // No URL, only id
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return response;
    }
    
    public ApiResponse<object> UpdateUser(UserUpdateDto user)
    {
        var apiResponse = new ApiResponse<object>();
        try
        {
            var (status, message) = updateRepo.UpdateUserDetails(user);
            apiResponse.Message = message;
            apiResponse.Status = status;
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return apiResponse;
    }

    public ApiResponse<object> RequestEmailChange(string newEmail)
    {
        var response = new ApiResponse<object>();
        try
        {
            var current = currUser.GetCurrentUser();
            if (current == null) throw new Exception("User not logged in");
            var (status,message) = updateRepo.SetPendingEmail(new Guid(current.UserId!),newEmail);
            response.Status = status; response.Message = message;
            if (!status.Equals("success")) return response;

            // Generate a token and send verification email to pending email.
            // Minimal inline token generation (reuse existing hash/random utilities)
            var token = GenerateResetPassToken(); // sufficiently random string util already present
            // Persist verification with EmailChange purpose. 
            var addRes = authUpdateRepo.AddOrUpdateVerificationRecord(new Guid(current.UserId!), token, VerificationPurpose.EmailChange);
            if (!addRes.status.Equals("success"))
            {
                response.Status = "error";
                response.Message = "Failed to create verification token";
                return response;
            }
            // Compose email content
            var verifyLink = $"http://localhost:3000/email-verify?token={token}&userId={current.UserId}";
            var content = $"<center style='font-size:20px; font-weight:600; color:#1F4167; margin-top:20px;'>Confirm your new email address</center><center style='color:#000000; margin-top:10px; font-size:15px;'>Click the button below to verify your new email. If you didn't request this change, ignore this email.</center><br><br><table width='750' border='0' cellspacing='0' cellpadding='0' align='center' style='position:relative;'><tbody><tr><td background='https://static.vecteezy.com/system/resources/previews/049/887/312/non_2x/email-verification-concept-receiving-incoming-email-sending-and-receiving-verification-email-can-be-used-for-web-page-banner-mobile-app-flat-illustration-isolated-on-background-vector.jpg' width='750' height='750' valign='top' style='background-repeat:no-repeat;background-position:center;background-size:cover;position:relative;'><div style='position:relative; width:100%; height:100%;'><a href='{verifyLink}' style='margin-top: 370px;margin-left: 210px;width:157px;height:35px;display:block;text-decoration:none;rotate:-16deg;border-radius:50px;background:none;cursor:pointer;'><span style='display:none;'>Verify New Email</span></a></div></td></tr></tbody></table>";
            var mailRes = SendEmailAsync(newEmail, "Verify your new GridSign email", content).Result; // sync wait acceptable here for simplicity
            if (!mailRes.status.Equals("success"))
            {
                response.Status = mailRes.status;
                response.Message = mailRes.message;
                return response;
            }
            response.Message = "Verification email sent to pending address";
        }
        catch (Exception e)
        {
            response.Status = "error"; response.Message = e.Message; Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return response;
    }

    public ApiResponse<object> VerifyEmailChange(Guid userId,string token)
    {
        var response = new ApiResponse<object>();
        try
        {  
            var (vStatus, vMsg, verification) = authViewRepo.GetVerificationRecord(userId);
            if (!vStatus.Equals("success") || verification == null)
            {
                response.Status = "error"; response.Message = "Verification record not found"; return response;
            }
            if (verification.Purpose != VerificationPurpose.EmailChange || verification.Token != token)
            {
                response.Status = "error"; response.Message = "Invalid token"; return response;
            }
            if (verification.IsAlreadyUsed || verification.ValidTill < DateTime.Now)
            {
                response.Status = "error"; response.Message = "Token expired or already used"; return response;
            }
            // Apply pending email
            var applyRes = updateRepo.ApplyPendingEmail(userId);
            if (!applyRes.status.Equals("success"))
            {
                response.Status = applyRes.status; response.Message = applyRes.message; return response;
            }
            // Mark token used
            authUpdateRepo.AddOrUpdateVerificationRecord(userId, GenerateOneTimePassword().ToString(), VerificationPurpose.EmailChange); // rotate token to invalidate quickly
            response.Status = "success"; response.Message = "Email verified successfully";
        }
        catch (Exception e)
        {
            response.Status = "error"; response.Message = e.Message; Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return response;
    }
}