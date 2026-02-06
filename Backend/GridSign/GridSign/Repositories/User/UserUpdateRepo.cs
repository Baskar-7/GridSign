using GridSign.Data;
using GridSign.Helpers;
using GridSign.Models.DTOs.RequestDTO;
using GridSign.Models.Entities;
using GridSign.Repositories.RepoHelper;
using GridSign.Repositories.User.Interfcae;
using GridSign.Repositories.UserControl.Interfcae;
using GridSign.Services.ServiceHelper.Interfaces;
using Microsoft.EntityFrameworkCore; 

namespace GridSign.Repositories.User;

public class UserUpdateRepo (ApplicationDbContext dbContext,IUserViewRepo viewRepo,IUserContext userContext) : RepoUtility(dbContext),IUserUpdateRepo
{
    private Guid GenerateGuid()
    {
        bool isValid;
        Guid guid;
        do
        {
            guid = Guid.NewGuid();
            (_,_,isValid) = viewRepo.IsValidUser(guid);
        }
        while (isValid);
        return guid;
    }
    
    public (string status, string message) CreateUser(Users user)
    {
        string status = "error",
            message = "Oops! An error occurred while trying to register the user."; 
        try
        {
            user.UserId = GenerateGuid();
            dbContext.Users.Add(user);
            dbContext.SaveChanges();
            status = "success";
            message = "User Registered Successfully!"; 
        }
        catch (Exception e)
        { 
            Logger.Logg(LoggLevel.Error,e.Message,e);
        } 
        return (status, message);
    }

    public (string status,string message,int? fileResourceId) UpdateUserProfilePic(Guid userId,byte[] profilePic)
    {
        string status = "error",
            message = "Oops! There was a problem updating the user's image.";
        int? fileResourceId = null;
        try
        {
            var user = dbContext.Users
                .Include(u => u.FileResource)
                .FirstOrDefault(u => u.UserId == userId);

            if (user == null)
            {
                message = "User not found.";
                return (status, message, fileResourceId);
            }

            // If FileResource does not exist, create a new one and assign ProfilePicId
            if (user.FileResource == null)
            {
                var newRes = new FileResource
                {
                    ResourceData = profilePic,
                    ResourceName = "ProfilePic",
                    FileType = FileResourceType.Picture,
                    UploadedByUserId = userId
                };
                dbContext.FileResources.Add(newRes);
                dbContext.SaveChanges(); // ensure ID generated
                user.ProfilePicId = newRes.FileResourceId;
                user.FileResource = newRes;
                fileResourceId = newRes.FileResourceId;
            }
            else
            {
                // Update existing FileResource
                user.FileResource.ResourceData = profilePic;
                fileResourceId = user.FileResource.FileResourceId;
            }

            dbContext.SaveChanges();
            status = "success";
            message = "User profile image has been updated!";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return (status, message, fileResourceId);
    }

    public (string, string) UpdateUserDetails(UserUpdateDto user)
    {
        var status = "error";
        var message = "Error occured while updating User details";
        try
        {
            var currentUser = userContext.GetCurrentUser();
            if (currentUser == null) {
                message = "User not found";
                return (status, message);
            }

            // Fetch the existing user from the database (convert string id to Guid)
            if (!Guid.TryParse(currentUser.UserId, out var currentUserGuid))
            {
                message = "Invalid user identifier format.";
                return (status, message);
            }
            var userEntity = dbContext.Users.Find(currentUserGuid);
            if (userEntity == null)
            {
                message = "User not found.";
                return (status, message);
            }
 
            userEntity.Fname = user.Fname!;
            userEntity.Lname = user.Lname!;
            // Do not overwrite primary email directly if it's changed; it must go through verification flow.
            if (!string.IsNullOrEmpty(user.Email) && user.Email != userEntity.Email)
            {
                // Set as pending; IsMailVerified becomes false until confirmed.
                userEntity.PendingEmail = user.Email;
                userEntity.IsMailVerified = false;
            }
            userEntity.Company = user.Company;
            userEntity.JobTitle = user.JobTitle;
            userEntity.TimeZone = user.TimeZone ?? userEntity.TimeZone;
            dbContext.SaveChanges();
            
            status = "success";
            message = "User details updated successfully";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message);
    }

    public (string status,string message) SetPendingEmail(Guid userId,string newEmail)
    {
        var status = "error"; var message = "Failed to set pending email";
        try
        {
            var user = dbContext.Users.FirstOrDefault(u => u.UserId == userId);
            if (user == null)
            {
                message = "User not found"; return (status,message);
            }
            if (string.IsNullOrWhiteSpace(newEmail))
            {
                message = "Email cannot be empty"; return (status,message);
            }
            if (newEmail == user.Email)
            {
                message = "New email is same as current email"; return (status,message);
            }
            // Ensure no other user has this email already
            var isDuplicate = dbContext.Users.Any(u => u.Email == newEmail);
            if (isDuplicate)
            {
                message = "Email already in use"; return (status,message);
            }
            user.PendingEmail = newEmail;
            user.IsMailVerified = false;
            dbContext.SaveChanges();
            status = "success"; message = "Pending email set";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return (status,message);
    }

    public (string status,string message) ApplyPendingEmail(Guid userId)
    {
        var status = "error"; var message = "Failed to apply pending email";
        try
        {
            var user = dbContext.Users.FirstOrDefault(u => u.UserId == userId);
            if (user == null)
            {
                message = "User not found"; return (status,message);
            }
            if (string.IsNullOrWhiteSpace(user.PendingEmail))
            {
                message = "No pending email to apply"; return (status,message);
            }
            // Final uniqueness check (unlikely needed if SetPendingEmail validated) but defensive
            var isDuplicate = dbContext.Users.Any(u => u.Email == user.PendingEmail);
            if (isDuplicate)
            {
                message = "Pending email already taken"; return (status,message);
            }
            user.Email = user.PendingEmail!;
            user.PendingEmail = null;
            user.IsMailVerified = true;
            dbContext.SaveChanges();
            status = "success"; message = "Email verified and updated";
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return (status,message);
    }
}