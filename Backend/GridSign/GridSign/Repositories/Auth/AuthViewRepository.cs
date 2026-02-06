using GridSign.Data;
using GridSign.Helpers;
using GridSign.Repositories.RepoHelper;
using GridSign.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace GridSign.Repositories.Auth;

public class AuthViewRepository(ApplicationDbContext dbContext): RepoUtility(dbContext),IAuthViewRepository
{ 
    public (string status, string message,int? verificationId) GetVerificationId(Guid userId)
    {
        string status = "error", message = "An unexpected error Occurred! Cannot find verification record!";
        int? verificationId = null;
        try
        {
            var verificationRecord = DbContext.Verification.FirstOrDefault(v => v.UserId == userId);
            if (verificationRecord != null) 
            {
                verificationId = verificationRecord.VerificationId;
                status = "success";
                message = "Verification record fetched successfully!.";
            }
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return (status, message, verificationId);
    }
    
    public (string status, string message, Verification? fetchedDeatils) GetVerificationRecord(string mail)
    {
        string status = "error",message = "Verification record not found!"; 
        Verification? verification = null;   
        try
        {
            verification = DbContext.Verification
                .Include(v => v.User)
                .FirstOrDefault(v => v.User.Email == mail);
            if(verification != null) 
            {
                status = "success";
                message = "Verification record fetched successfully!";
            } 
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return (status, message, verification);
    }

    public (string status, string message, DateTime lastPasswordChangeTime, bool isAlreadyUsed) GetLastPasswordChangeTime(string email)
    {
        var status = "success"; // Default to success unless something fails
        var message = "No previous password reset found. Proceeding.";
        var lastPasswordChangeTime = DateTime.MinValue;
        var isAlreadyUsed = false;

        try
        {
            var verificationRecord = DbContext.Verification.FirstOrDefault(v => v.User.Email == email);
            if (verificationRecord != null)
            {
                lastPasswordChangeTime = verificationRecord.ValidTill;
                isAlreadyUsed = verificationRecord.IsAlreadyUsed;
                message = "Successfully retrieved the last password change timestamp!";
            }
            else
            {
                // No record found — allow password reset (first-time case)
                message = "No previous password reset record found.";
            }
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
            status = "error";
            message = "An error occurred while retrieving the password update time.";
        }

        return (status, message, lastPasswordChangeTime, isAlreadyUsed);
    }

    public (string status, string message, Verification? fetchedDetails) GetVerificationRecord(Guid userId)
    {
        string status = "error", message = "Verification record not found!";
        Verification? verification = null;
        try
        {
            verification = DbContext.Verification
                .Include(v => v.User)
                .FirstOrDefault(v => v.UserId == userId);
            if (verification != null)
            {
                status = "success";
                message = "Verification record fetched successfully!";
            }
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message, verification);
    }
}