using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GridSign.Models.Entities;

public class Verification
{
    [Key]
    public int VerificationId { get; set; }
    [ForeignKey("Users")]
    public Guid UserId { get; set; }
    public string Token { get; set; }
    public DateTime ValidTill { get; set; }
    public bool IsAlreadyUsed { get; set; }
    // Purpose of this verification token (PasswordReset, Otp, EmailChange etc.)
    public VerificationPurpose Purpose { get; set; } = VerificationPurpose.PasswordReset;
    
    public Users User { get; set; }
}

public enum VerificationPurpose
{
    PasswordReset = 0,
    Otp = 1,
    EmailChange = 2,
    DocumentSign = 3
}