using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GridSign.Models.Entities;

public class Notification
{
    [Key]
    public int NotificationId { get; set; }
    [ForeignKey("Users")]
    public Guid UserId { get; set; } 
    public string Message { get; set; }
    public DateTime SentAt { get; set; }
    
    public Users User { get; set; } 
}