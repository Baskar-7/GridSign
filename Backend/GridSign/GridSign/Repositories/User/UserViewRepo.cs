using GridSign.Data;
using GridSign.Helpers;
using GridSign.Models.Entities;
using GridSign.Repositories.RepoHelper;
using GridSign.Repositories.UserControl.Interfcae;

namespace GridSign.Repositories.User;

public class UserViewRepo(ApplicationDbContext dbContext) : RepoUtility(dbContext), IUserViewRepo
{
    public (string status, string message, bool isDuplicateEmail, Guid userId) IsDuplicateEmail(string email)
    {
        var status = "error";
        var message = "An account with this email already exists";
        var isDuplicateEmail = true;
        var userId = Guid.Empty;
        try
        { 
            var user = DbContext.Users 
                .FirstOrDefault(u => u.Email == email);

            if (user == null) {
                isDuplicateEmail = false;
                status = "success";
                message = "This email is not associated with any user.";
            }
            else {
                userId = user.UserId;
            }
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message, e);
        }
        return (status, message, isDuplicateEmail, userId);
    }
    
    public (string status,string message,Users? user) GetUserDetailsWithEmail(string mail)
    {
        string status = "error",
            message = "An unexpected error Occurred! While fetching User Details!..";
        Users? user = null;
        try
        {
            user = DbContext.Users.FirstOrDefault(u => u.Email == mail);
            if(user == null)
                message = "User Details Not Found!";
            else
            {
                status = "success";
                message = "User Details Fetched Successfully!";
            } 
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        
        return (status, message,user);
    }
    
    public (string status,string message,Users? user) GetUserDetailsWithUserId(Guid userId)
    {
        string status = "error",
            message = "An unexpected error Occurred! While fetching User Details!..";
        Users? user = null;
        try
        {
            user = DbContext.Users.FirstOrDefault(u => u.UserId == userId);
            if(user == null)
                message = "User Details Not Found!";
            else
            {
                status = "success";
                message = "User Details Fetched Successfully!";
            } 
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        
        return (status, message,user);
    }

    public (string status, string message, bool isValid) IsValidUser(Guid userId)
    {
        string status = "error",message = "An account with this email already exists";
        var isValid = false;
        try
        {
            var user =  DbContext.Users.FirstOrDefault(u => u.UserId == userId);
            if (user != null){
                isValid = true;
                status = "success";
                message = "This UserId is not associated with any user.";
            } 
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return (status, message, isValid);
    }
    
    public (string status,string message, Guid userId) GetUserId(string email)
    {
        string status = "error", message = "An unexpected error Occurred! While fetching User Details!"; 
        var userId = Guid.Empty;
        try
        {
           var user = DbContext.Users.FirstOrDefault(u => u.Email == email);
            if (user != null){ 
                userId = user.UserId;
                status = "success";
                message = "User Detail Fetched Successfully!";
            } 
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e); 
        }
        return (status, message, userId);
    }
}