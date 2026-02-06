using System.Security.Claims;
using GridSign.Models;
using GridSign.Models.DTOs.RequestDTO;
using GridSign.Services.ServiceHelper.Interfaces;

namespace GridSign.Services.ServiceHelper;

public class UserContext(IHttpContextAccessor httpContextAccessor) : IUserContext
{
    public CurrentUser? GetCurrentUser()
    {
        var user = httpContextAccessor.HttpContext?.User;
        if (user == null || !user.Identity!.IsAuthenticated)
            return null;

        return new CurrentUser
        {
            UserId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value,
            Email = user.FindFirst(ClaimTypes.Email)?.Value,
            Username = user.FindFirst(ClaimTypes.Name)?.Value, 
            Role = user.FindFirst(ClaimTypes.Role)?.Value
        };
    }
}