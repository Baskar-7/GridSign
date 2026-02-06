namespace GridSign.Models.DTOs.ResponseDTO;

public class UserProfileDto
{ 
    public Guid UserId { get; set; } 
    public string? Fname { get; set; } 
    public string? Lname { get; set; } 
    public string? Email { get; set; } 
    // New email awaiting verification (null if none pending)
    public string? PendingEmail { get; set; }
    public bool IsMailVerified { get; set; }
    public string? Company{ get; set; }
    public string? JobTitle { get; set; }
    private string? TimeZoneId { get; set; }
    public TimeZoneInfo TimeZone
    {
        get => string.IsNullOrEmpty(TimeZoneId) 
            ? TimeZoneInfo.Utc 
            : TimeZoneInfo.FindSystemTimeZoneById(TimeZoneId);
        set => TimeZoneId = value?.Id;
    }
    public  string? UserRole { get; set; } 
    // Image file resource id if user uploaded a profile picture
    public int? ProfilePicFileResourceId { get; set; }
}