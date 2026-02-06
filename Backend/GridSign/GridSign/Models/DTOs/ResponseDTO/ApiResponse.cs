namespace GridSign.Models.DTOs.ResponseDTO;

public class ApiResponse<T>
{ 
    public string Status { get; set; } = "error";
    public string Message { get; set; } = "An unexpected error Occurred! Pls try again after sometime!..";
    public T Data { get; set; }
} 