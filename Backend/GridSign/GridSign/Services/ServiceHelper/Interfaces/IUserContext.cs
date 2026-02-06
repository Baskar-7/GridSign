using GridSign.Models;
using GridSign.Models.DTOs.RequestDTO;

namespace GridSign.Services.ServiceHelper.Interfaces;

public interface IUserContext
{
    CurrentUser? GetCurrentUser();
}