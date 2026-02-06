namespace GridSign.Repositories.Auth;
using GridSign.Models.Entities;

public interface IAuthViewRepository
{ 
    (string status, string message, int? verificationId) GetVerificationId(Guid userId);
    (string status, string message, Verification? fetchedDeatils) GetVerificationRecord(string mail);
    (string status, string message, Verification? fetchedDetails) GetVerificationRecord(Guid userId);
    public (string status, string message, DateTime lastPasswordChangeTime, bool isAlreadyUsed) GetLastPasswordChangeTime(string email);

}