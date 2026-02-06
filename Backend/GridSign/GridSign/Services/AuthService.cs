using GridSign.Helpers;
using GridSign.Models.DTOs.RequestDTO;
using GridSign.Models.DTOs.ResponseDTO;
using GridSign.Models.Entities;
using GridSign.Repositories.Auth;
using GridSign.Repositories.Auth.Interfaces;
using GridSign.Repositories.User.Interfcae;
using GridSign.Services.Interfaces;
using GridSign.Services.ServiceHelper; 
using GridSign.Repositories.UserControl.Interfcae;   

namespace GridSign.Services;

public class AuthService(IAuthUpdateRepository authUpdateRepo,IAuthViewRepository authViewRepo,IUserUpdateRepo userUpdateRepo,IUserViewRepo userViewRepo) :  ServiceUtility,IAuthService
{ 
    public ApiResponse<AuthResponseDTO>  AuthenticateUser(SignInReqDto user)
    { 
        var response = new ApiResponse<AuthResponseDTO>();
        try { 
            var (status, _,userInfo) = userViewRepo.GetUserDetailsWithEmail(user.Email);
            if (status.Equals("success"))
            {
                var (password,_) = Hash(user.Password,Convert.FromBase64String(userInfo!.PasswordSalt));
                if (userInfo.PasswordHash.Equals(password))
                {
                    var token = GenerateJwtToken(userInfo.Fname,userInfo.Email,userInfo.UserId.ToString(),userInfo.UserRole!);
                    response.Data = new AuthResponseDTO
                    {
                        Token = token,
                        Role = userInfo.UserRole!,
                        Username = $"{userInfo.Fname} {userInfo.Lname}",
                    };
                    response.Status = status;
                    response.Message = "Login Successful!";
                }
                else
                {
                    response.Message = "Invalid Password!";
                }
            }
            else
            {
                response.Message = "INVALID EMAIL";
            }
        }
        catch (Exception e) {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        } 
        return response;
    }

    public async Task<ApiResponse<AuthResponseDTO>> SendResetPasswordLink(SendOtpReqDto sendResetPassDto)
    {
        var response = new ApiResponse<AuthResponseDTO>();
        try
        {
            var (fetchStatus, fetchMessage, lastPasswordChangeTime, isAlreadyUsed) = authViewRepo.GetLastPasswordChangeTime(sendResetPassDto.Email);
            var hasPreviousRecord = lastPasswordChangeTime != DateTime.MinValue;

            var isLinkExpired = hasPreviousRecord &&
                                lastPasswordChangeTime.AddHours(12) > DateTime.Now &&
                                isAlreadyUsed;

            if (isLinkExpired || fetchStatus.Equals("error"))
            {
                response.Status = "error";
                var remainingTime = lastPasswordChangeTime.AddHours(12) - DateTime.Now;
                var timeLeft = remainingTime.TotalHours >= 1 
                    ? Math.Ceiling(remainingTime.TotalHours) + " hrs" 
                    : Math.Ceiling(remainingTime.TotalMinutes) + " mins";

                response.Message = fetchStatus.Equals("error") 
                    ? fetchMessage 
                    : $"You’ve already changed your password within the last 12 hours. Please try again after {timeLeft}.";
                return response;
            }
            
            var resetToken = GenerateResetPassToken();
            var content = $"<center style=\"color:#000\">You have submitted a password change request.</center><br><center style=\"color:#000\">If it wasn't you, please disregard this email and make sure you can still login to your account.</center><table width='100%' border='0' cellspacing='0' cellpadding='0'><tr><td style='text-align:center;'><center><div  style=\"background-image: url('https://img.freepik.com/free-vector/reset-password-concept-illustration_114360-7866.jpg'); max-width:100%; height:400px; width:600px;\"></div></center></td></tr></table><center style=\"color:#000\"> If it was you, then <b>confirm the password change <a href='http://localhost:3000/reset-password?token={resetToken}&mail={sendResetPassDto.Email}'>Click here</a></b></center>";
            var (mailStatus, mailMessage) = await SendEmailAsync(sendResetPassDto.Email, "GridSign", content);
            if (!mailStatus.Equals("success"))
            { 
                response.Status = mailStatus;
                response.Message = mailMessage;
                return response;
            } 
            
            var (addRecordStatus, addRecordMsg) = AddNewVerificationRecord(sendResetPassDto,resetToken, VerificationPurpose.PasswordReset);
            response.Status = addRecordStatus;
            response.Message = addRecordStatus.Equals("success") ?  "The password reset link has been successfully sent to your email address!" : addRecordMsg;
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return response;
    }

    public async Task<ApiResponse<AuthResponseDTO>> SendOtp(SendOtpReqDto sendOtpReq)
    {
        var response = new ApiResponse<AuthResponseDTO>();
        try
        {
            var oneTimePassword = GenerateOneTimePassword();
            var content="Please enter the below OTP to continue.<table width='750px' border='0' cellspacing='0' cellpadding='0'><tbody><tr><td background='https://i.postimg.cc/SRG7Mhp5/OTPTemplate.jpg'  style='background-repeat:no-repeat' width='100%' height='750' valign='top' class='bgresize'><div><table width='50%' border='0' cellspacing='0' cellpadding='0'><tbody><tr><td align='left' valign='top' class='mobile-padding'><table width='100%' border='0' cellspacing='0' cellpadding='0'><tbody><tr><td align='left' valign='top' style='padding-top: 220px;padding-left:215px;font-size:45px;color: #1F4167;letter-spacing: 14px;' class='padding65'><span class='banner-heading55'>"+oneTimePassword+"</span></td></tr></tbody></table></td></tr></tbody></table></div></td></tr></tbody></table>";
            var (mailStatus, mailMessage) = await SendEmailAsync(sendOtpReq.Email, "GridSign", content);
            if (!mailStatus.Equals("success"))
            { 
                response.Status = mailStatus;
                response.Message = mailMessage;
                return response;
            }

            var (addRecordStatus, addRecordMsg) = AddNewVerificationRecord(sendOtpReq,oneTimePassword.ToString(), VerificationPurpose.Otp);
            response.Status = addRecordStatus;
            response.Message = addRecordStatus.Equals("success") ?  "Otp send to your email address successfully!" : addRecordMsg;
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e); 
        }
        return response;
    }

    private (string status, string message ) AddNewVerificationRecord(SendOtpReqDto sendOtpReq,string token, VerificationPurpose purpose)
    {
        var status = "error";
        var message = "An Exception occured while adding new verification record";
        try
        {
            var (userIdStatus,userIdMessage,userId) = userViewRepo.GetUserId(sendOtpReq.Email);
            if (!userIdStatus.Equals("success"))
            {
                 return (userIdStatus, userIdMessage);
            }

            var (updateStatus, _) = authUpdateRepo.AddOrUpdateVerificationRecord(userId,token,purpose);
            if (updateStatus.Equals("success"))
            {
                status = updateStatus;
                message = "Verification code has been added!";
            } 
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return (status,message);
    }
    
    public ApiResponse<AuthResponseDTO> GoogleAuthenticateUser(GoogleSignInRequestDto user)
    {
        var response = new ApiResponse<AuthResponseDTO>(); 
        try
        {
            var (_, _, isDuplicateEmail,userId) = userViewRepo.IsDuplicateEmail(user.Email); 
            if (!isDuplicateEmail)
            {
                var (passwordHash,passwordSalt) = Hash("1234"); 
                var userAcc = new Users
                {
                    Fname = user.Fname, Lname = "User", PasswordHash = passwordHash, PasswordSalt = passwordSalt,
                    Email = user.Email, UserRole = "User"
                };
                var (addUserStatus, addUserMessage) = userUpdateRepo.CreateUser(userAcc);
                response.Status = addUserStatus;
                response.Message = addUserMessage;
                userId = userAcc.UserId;
            }
            
            if (response.Status.Equals("success") || isDuplicateEmail)
            {
                response.Data = new AuthResponseDTO
                {
                    Token = GenerateJwtToken(user.Fname,user.Email, userId.ToString(), "User"),
                    Role = "User",
                    Username = $"{user.Fname} User",
                };
            }
            response.Status = "success";
            response.Message = "Logged-in successfully!";
        }
        catch (Exception e) {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return response;
    }
    
    public ApiResponse<AuthResponseDTO> UpdatePassword(PasswordChangeDto passwordChangeDto)
    {
        var response = new ApiResponse<AuthResponseDTO>(); 
        try
        {
            var (fetchStatus,_,fetchedDeatils) =  authViewRepo.GetVerificationRecord(passwordChangeDto.Email);
            if (!fetchStatus.Equals("success") || !fetchedDeatils!.Token.Equals(passwordChangeDto.Token))
            {
                response.Status = fetchStatus;
                response.Message = "Request denied due to bad credentials!";
                return response;
            }

            if (fetchedDeatils.ValidTill < DateTime.Now || fetchedDeatils.IsAlreadyUsed)
            {
                response.Status = fetchStatus;
                response.Message = "link Expired! Please make new request!";
                return response;
            }
            var (passwordHash,passwordSalt) = Hash(passwordChangeDto.password);
            var updateRes=authUpdateRepo.UpdatePasswordWithVerificationEntry(fetchedDeatils.UserId, passwordHash, passwordSalt, fetchedDeatils.VerificationId);
            response.Status = updateRes.status;
            response.Message = updateRes.message;
        }
        catch(Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return response;
    }

    public ApiResponse<object> IsValidResetPassUrl(ResetPassLinkCheckDto linkCheckDto)
    { 
        var response = new ApiResponse<object>();
        try
        {
            var isValidUrl = new { IsValidResetPassUrl = false };
            var (fetchStatus,statusMessage,verification) = authViewRepo.GetVerificationRecord(linkCheckDto.EMail);
            if (!fetchStatus.Equals("success"))
            {
                response.Status = fetchStatus;
                response.Message = statusMessage;
                response.Data = isValidUrl;
                return response;
            }

            if (verification!.IsAlreadyUsed || verification.Token != linkCheckDto.Token)
            {
                response.Status = "error";
                response.Message = "Link Expired! Please make new request!";
                response.Data = isValidUrl;
                return response;
            }
            
            response.Status = "success";
            response.Message = "URL verified successfully. Please go ahead.";
            response.Data =  new { IsValidResetPassUrl = true };
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return response;
    }
}