using GridSign.Models.DTOs.CommonDTO;
using GridSign.Models.Entities;

namespace GridSign.Models.DTOs.RequestDTO;

public class GetWorkflowsDto : BaseListRequestDto
{
    public List<WorkflowStatus>? Statuses { get; set; } // allow multiple
}
