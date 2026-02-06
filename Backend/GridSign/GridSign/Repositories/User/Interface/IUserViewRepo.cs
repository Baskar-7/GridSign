using GridSign.Models.Entities;

namespace GridSign.Repositories.UserControl.Interfcae;

public interface IUserViewRepo
{
    (string status, string message, bool isDuplicateEmail, Guid userId) IsDuplicateEmail(string email);
    (string status, string message, Users? user) GetUserDetailsWithEmail(string mail);
    (string status, string message, Users? user) GetUserDetailsWithUserId(Guid userId);
    (string status, string message, bool isValid) IsValidUser(Guid guid);
    (string status, string message, Guid userId) GetUserId(string email);

}