using GridSign.Models.DTOs.CommonDTO;

namespace GridSign.Models.DTOs.RequestDTO;

/// Request parameters for fetching sign forms assigned to the current user.
/// Mirrors BaseListRequestDto for pagination/search/sort and adds date range + status filtering.
public class GetSignFormsRequestDto : BaseListRequestDto
{
    // Limit results to envelopes whose SentAt (or workflow CreatedOn fallback) are within preset range
    // Allowed values: 7d,30d,90d,all (fallback to all if invalid)
    public string? DateRange { get; set; } = "30d"; 

    // Filter by semantic status classification (Pending,Signed,Expired)
    public List<string>? Statuses { get; set; }
}
