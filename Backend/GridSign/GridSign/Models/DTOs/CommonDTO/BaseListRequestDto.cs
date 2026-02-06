namespace GridSign.Models.DTOs.CommonDTO;
 

/// Represents the common request parameters for pagination, searching, and sorting.
/// Can be reused across multiple list-based APIs. 
public class BaseListRequestDto
{
    // Pagination
    public int PageNumber { get; set; } = 1;   // which page to fetch
    public int PageSize { get; set; } = 10;    // how many items per page

    // Search
    public string? SearchTerm { get; set; }    // search by name, owner, etc. 

    //  Sorting
    public string? SortBy { get; set; } = "Name"; // column to sort
    public bool IsDescending { get; set; } = true;       // true = DESC, false = ASC
}