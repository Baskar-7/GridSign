using System.ComponentModel.DataAnnotations;

namespace GridSign.Models.Entities;

public class Image
{
    [Key]
    public int ImageId { get; set; }
    public DateTime CreatedAt { get; set; }
    [MaxLength(255)]
    public string? Img { get; set; }
    [MaxLength(255)]
    public string? GdFileId { get; set; }
}