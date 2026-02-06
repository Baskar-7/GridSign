namespace GridSign.Models.DTOs.CommonDTO;

/// Represents a standardized paginated response model.
/// Can be reused across any API that returns paged results. 
public class BasePagedResponseDto<T>
{ 
    public IEnumerable<T> Items { get; set; } = Enumerable.Empty<T>();   /// The list of items for the current page. 
    public int TotalCount { get; set; } // The total number of records across all pages.
    public int PageNumber { get; set; }  // The current page number.
    public int PageSize { get; set; } // The number of records per page.
    private int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);  // The total number of pages based on TotalCount and PageSize.
 
    public bool HasPreviousPage => PageNumber > 1;  // Indicates whether there is a previous page.
 
    public bool HasNextPage => PageNumber < TotalPages;  // Indicates whether there is a next page.
}
