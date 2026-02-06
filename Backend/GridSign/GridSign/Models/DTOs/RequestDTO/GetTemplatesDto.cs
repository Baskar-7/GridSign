using GridSign.Models.DTOs.CommonDTO; 

namespace GridSign.Models.DTOs.RequestDTO;

public enum SigningModeFilter
{
    All = 0,         // show all templates (no filter)
    Sequential = 1,  // only sequential signing templates
    Parallel = 2     // only parallel signing templates
}

public class GetTemplatesDto: BaseListRequestDto
{
    public SigningModeFilter SigningModeFilter { get; set; } = SigningModeFilter.All;
    public DateTime? StartDate { get; set; } 
    public DateTime? EndDate { get; set; } 
}