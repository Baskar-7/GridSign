namespace GridSign.Models.DTOs.RequestDTO;

public class SignupRequestDto
{
    public Guid UserId { get; set; }
    public string Fname { get; set; } = string.Empty;
    public string Lname { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}