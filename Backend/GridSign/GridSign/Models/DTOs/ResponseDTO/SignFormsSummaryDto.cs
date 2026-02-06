namespace GridSign.Models.DTOs.ResponseDTO;

/// Summary wrapper for sign forms list including counts for metrics widgets.
public class SignFormsSummaryDto
{
    public List<SignFormDto> Items { get; set; } = new();
    public int TotalPending { get; set; }
    public int TotalSigned { get; set; }
    public int TotalExpired { get; set; }
    public int TotalAll { get; set; }
}
