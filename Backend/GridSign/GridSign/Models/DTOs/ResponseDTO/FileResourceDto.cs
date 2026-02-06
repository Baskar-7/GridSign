namespace GridSign.Models.DTOs.ResponseDTO;

public class FileResourceDto
{
    public byte[] ResourceData { get; set; } = [];
    public string ContentType { get; set; } = "application/octet-stream";
    public string FileName { get; set; } = string.Empty;
}