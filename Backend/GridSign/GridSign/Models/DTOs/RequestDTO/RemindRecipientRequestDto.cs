using System.ComponentModel.DataAnnotations;

namespace GridSign.Models.DTOs.RequestDTO;

/// <summary>
/// Request payload for single recipient reminder.
/// </summary>
public class RemindRecipientRequestDto
{
    [Required]
    public int RecipientId { get; set; }
}
