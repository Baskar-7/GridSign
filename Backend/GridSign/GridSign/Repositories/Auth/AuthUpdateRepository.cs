using GridSign.Data;
using GridSign.Helpers;
using GridSign.Models.Entities;
using GridSign.Repositories.Auth.Interfaces;
using GridSign.Repositories.RepoHelper;  

namespace GridSign.Repositories.Auth;

public class AuthUpdateRepository(ApplicationDbContext dbContext,IAuthViewRepository authViewRepo) : RepoUtility(dbContext),IAuthUpdateRepository
{
    public (string status,string message) AddOrUpdateVerificationRecord(Guid userId,string token, VerificationPurpose purpose = VerificationPurpose.PasswordReset)
    {
        var status = "error";
        var message = "Oops! There was a problem adding the verification record.";
        try
        {
            var fetcher = authViewRepo.GetVerificationId(userId);
            if (fetcher.status.Equals("success"))
            {
                var updater = UpdateVerificationRecord(fetcher.verificationId!.Value,token,purpose);
                if (!updater.status.Equals("success")) return (status, message);
                status = "success";
                message = "Verification code has been updated!";
                return (status,message);
            }
            
            var verificationRecord = new Verification { UserId = userId, Token = token ,ValidTill = DateTime.Now.AddMinutes(30) , IsAlreadyUsed = false, Purpose = purpose };
            DbContext.Verification.Add(verificationRecord);
            DbContext.SaveChanges(); 
            status = "success";
            message = "Verification code has been updated!";  
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return (status, message);
    }
    
    private (string status,string message) UpdateVerificationRecord(int verificationId,string token, VerificationPurpose purpose)
    {
        var status = "error";
        var message = "Oops! There was a problem update the verification record.";
        try
        { 
            var record = DbContext.Verification.FirstOrDefault(v => v.VerificationId == verificationId);
            if(record == null)
                message = "Verification record not found";
            else
            {
                record.Token = token;
                record.ValidTill = DateTime.Now.AddMinutes(30);
                record.Purpose = purpose;
                record.IsAlreadyUsed = false;
                DbContext.Verification.Update(record);
                DbContext.SaveChanges();
                status = "success";
                message = "Verification code has been updated!";
            } 
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return (status, message);
    }

    public (string status, string message) UpdatePasswordWithVerificationEntry(Guid userId, string passwordhash,string passwordSalt, int verificationRecordId)
    {
        var status = "error";
        var message = "Oops! There was a problem update the verification record.";
        try
        {
           var passUpdater = UpdatePassword(userId, passwordhash, passwordSalt);
           if (passUpdater.status.Equals("error"))
           { 
               return (status=passUpdater.status, message=passUpdater.message);
           }
           
           var statusUpdater = UpdateVerificationEntryStatus(verificationRecordId,true);
           status = statusUpdater.status;
           if (statusUpdater.status.Equals("error"))
           {
               message = statusUpdater.message; 
               return (status,message);
           }
           message = passUpdater.message; 
        }
        catch (Exception e)
        { 
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return (status, message);
    }
    
    private (string status, string message) UpdateVerificationEntryStatus(int verificationRecordId,bool recordStatus)
    {
        var status = "error";
        var message = "Oops! There was a problem update the verification record.";
        try
        { 
            var vRecord = DbContext.Verification.FirstOrDefault(ver => ver.VerificationId == verificationRecordId);
            if(vRecord == null)
                message = "Verification record not found";
            else
            {
                vRecord.IsAlreadyUsed = recordStatus;
                vRecord.VerificationId = verificationRecordId;
                DbContext.Verification.Update(vRecord);
                DbContext.SaveChanges();
                status = "success";
                message = "Verification record status has been updated!";
            }
        }
        catch (Exception e)
        {
           Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return (status, message);
    }

    public (string status,string message) MarkVerificationUsed(int verificationRecordId)
    {
        return UpdateVerificationEntryStatus(verificationRecordId,true);
    }
    
    public (string status, string message) UpdatePassword(Guid userId, string passwordHash,string passwordSalt)
    {
        var status = "error";
        var message = "Oops! There was a problem updating the password.";
        try
        { 
            var user = DbContext.Users 
                .FirstOrDefault(u => u.UserId == userId);
            if (user == null)
                message = "User not found";
            else
            {
                user.PasswordHash = passwordHash;
                user.PasswordSalt = passwordSalt;
                DbContext.Users.Update(user);
                DbContext.SaveChanges();
                status = "success";
                message = "Password has been updated successfully!";
            }
        } 
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return (status, message);
    }
}