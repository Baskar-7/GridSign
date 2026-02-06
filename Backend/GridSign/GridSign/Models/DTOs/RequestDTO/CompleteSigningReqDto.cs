namespace GridSign.Models.DTOs.RequestDTO;

public class CompleteSigningReqDto
{
    public int RecipientId { get; set; } 
    public string Token { get; set; } = string.Empty; // one-time signing token from email link
}