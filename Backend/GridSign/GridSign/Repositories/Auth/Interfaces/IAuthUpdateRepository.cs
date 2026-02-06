using System;
using GridSign.Models.Entities;
namespace GridSign.Repositories.Auth.Interfaces;

public interface IAuthUpdateRepository
{
    (string status,string message) AddOrUpdateVerificationRecord(Guid userId,string token, VerificationPurpose purpose = VerificationPurpose.PasswordReset);
    (string status,string message) UpdatePassword(Guid userId, string passwordhash, string passwordSalt);
    (string status,string message) UpdatePasswordWithVerificationEntry(Guid userId, string passwordhash, string passwordSalt, int verificationRecordId);
    (string status,string message) MarkVerificationUsed(int verificationRecordId);
}