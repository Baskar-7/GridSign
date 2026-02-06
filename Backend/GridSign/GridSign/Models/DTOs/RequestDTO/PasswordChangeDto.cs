namespace GridSign.Models.DTOs.RequestDTO;

public class PasswordChangeDto
{
    public string password{get;set;}
    
    public string Token {get;set;}
    
    public string Email {get;set;}
}