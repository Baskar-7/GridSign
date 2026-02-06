using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using GridSign.Configurations;
using GridSign.Services.Util;
using Microsoft.IdentityModel.Tokens;

namespace GridSign.Services.ServiceHelper;

public class ServiceUtility 
{
    protected int GenerateOneTimePassword()
    {
        return new Random().Next(1000, 10000); 
    }

    protected async Task<byte[]> ConvertDocToBytes(IFormFile file)
    {
        using var ms = new MemoryStream();
        await file.CopyToAsync(ms);
        return ms.ToArray();
    }
     
    protected async Task<(string status,string message)> SendEmailAsync(string toAddress, string subject, string body)
    {
        return await SendMail.Send(toAddress, subject, body);
    }

    protected string GenerateResetPassToken()
    {
        return Guid.NewGuid().ToString("N"); 
    }

    protected string GenerateUniqueNames()
    {
        string baseName = "Template";
        string slug = Regex.Replace(baseName.ToLower(), @"[^a-z0-9]+", "_");
        string uniqueName = $"{slug}_{DateTime.Now:yyyyMMdd_HHmmss}";
        return uniqueName;
    }
    
    protected string GenerateJwtToken(string fname, string email,string userId, string userRole)
    {
        var jwtSettings = Configs.JwtSettings;

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, userId),   // userId
            new Claim(ClaimTypes.Name, fname),             // username
            new Claim(ClaimTypes.Email, email),            // email
            new Claim(ClaimTypes.Role, userRole)           // role
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings["Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: jwtSettings["Issuer"],
            audience: jwtSettings["Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
    
    protected static (string Hash, string Salt) Hash(string password)
    { 
        return Hash(password, RandomNumberGenerator.GetBytes(16));
    }
    protected static (string Hash, string Salt) Hash(string password, byte[] saltBytes)
    {
        var pbkdf2 = new Rfc2898DeriveBytes(password, saltBytes, 100_000, HashAlgorithmName.SHA256);
        var hashBytes = pbkdf2.GetBytes(32); // 256-bit hash
        return (Convert.ToBase64String(hashBytes), Convert.ToBase64String(saltBytes));
    }
    
    protected static string? DetectContentType(string? name, byte[] data)
    {
        if (!string.IsNullOrWhiteSpace(name))
        {
            var lower = name.ToLowerInvariant();
            if (lower.EndsWith(".pdf")) return "application/pdf";
            if (lower.EndsWith(".png")) return "image/png";
            if (lower.EndsWith(".jpg") || lower.EndsWith(".jpeg")) return "image/jpeg";
            if (lower.EndsWith(".txt")) return "text/plain";
        }
        // Minimal magic number checks
        if (data.Length > 4)
        {
            // PDF starts with %PDF
            if (data[0] == 0x25 && data[1] == 0x50 && data[2] == 0x44 && data[3] == 0x46) return "application/pdf";
            // PNG signature 89 50 4E 47
            if (data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47) return "image/png";
            // JPG FF D8
            if (data[0] == 0xFF && data[1] == 0xD8) return "image/jpeg";
        }
        return null;
    }

    protected static string? GuessExtension(string contentType) => contentType switch
    {
        "application/pdf" => "pdf",
        "image/png" => "png",
        "image/jpeg" => "jpg",
        "text/plain" => "txt",
        _ => null
    };
}