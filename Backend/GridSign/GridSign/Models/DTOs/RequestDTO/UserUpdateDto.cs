
namespace GridSign.Models.DTOs.RequestDTO;

public class UserUpdateDto
{
    public  string? Fname { get; set; }
    public  string? Lname { get; set; }
    public  string? Email { get; set; }
    public  string? Password { get; set; }
    public string? Company{ get; set; }
    public string? JobTitle { get; set; } 
    public TimeZoneInfo? TimeZone { get; set; }
    
}