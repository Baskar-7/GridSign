using GridSign.Models.DTOs.RequestDTO;
using GridSign.Models.Entities;

namespace GridSign.Repositories.User.Interfcae;

public interface IUserUpdateRepo
{
    (string status, string message) CreateUser(Users user);

    (string,string) UpdateUserDetails(UserUpdateDto user);

    // Returns status, message, and the FileResourceId (if updated/created) for the profile picture
    (string status, string message, int? fileResourceId) UpdateUserProfilePic(Guid userId, byte[] profilePic);

    // Set a new pending email (does not overwrite primary Email until verification)
    (string status,string message) SetPendingEmail(Guid userId,string newEmail);

    // After successful verification: promote PendingEmail to Email
    (string status,string message) ApplyPendingEmail(Guid userId);
}