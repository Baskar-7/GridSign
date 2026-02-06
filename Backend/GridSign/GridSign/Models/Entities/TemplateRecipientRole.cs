using System.ComponentModel.DataAnnotations;

namespace GridSign.Models.Entities;

public class TemplateRecipientRole
{
    [Key]
    public int RoleId { get; set; }
    public string Role { get; set; }
    public int RolePriority { get; set; }
}