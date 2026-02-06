using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GridSign.Models.Entities;

public class Users
{
    [Key]
    public Guid UserId { get; set; }
    [MaxLength(100)]
    public required string Fname { get; set; }
    [MaxLength(100)]
    public required string Lname { get; set; }
    [MaxLength(100)]
    public required string Email { get; set; } 
    // New email awaiting verification (do not overwrite Email until verified)
    [MaxLength(100)]
    public string? PendingEmail { get; set; }
    // Whether the current primary Email has been verified
    public bool IsMailVerified { get; set; } = false;
    [MaxLength(255)]
    public required  string PasswordHash { get; set; }
    [MaxLength(255)]
    public required string PasswordSalt { get; set; }
    [MaxLength(100)]
    public string? Company{ get; set; }
    [MaxLength(100)]
    public string? JobTitle { get; set; }
     
    [MaxLength(100)]
    private string? TimeZoneId { get; set; }

    // Not mapped to DB
    [NotMapped]
    public TimeZoneInfo TimeZone
    {
        get => string.IsNullOrEmpty(TimeZoneId) 
            ? TimeZoneInfo.Utc 
            : TimeZoneInfo.FindSystemTimeZoneById(TimeZoneId);
        set => TimeZoneId = value?.Id;
    }
    [MaxLength(100)]
    public  string? UserRole { get; set; } 
    [ForeignKey("FileResource")]
    public int? ProfilePicId { get; set; }
    
    public FileResource? FileResource { get; set; }
     
}