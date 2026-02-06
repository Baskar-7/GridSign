using GridSign.Models.DTOs.ResponseDTO;

namespace GridSign.Services.Interfaces;

public interface IReportsService
{
    // Extended aggregated report (activity, template usage, stacked status, top users, recent events)
    ApiResponse<ReportExtendedDto> GetExtendedReport(string? dateRange = null);
    // Aggregated sidebar snapshot (quick stats, completion rate, expiring workflows subset)
    ApiResponse<SidebarReportDto> GetSidebarReport(int expiringDays = 14, int expiringLimit = 8);
}
