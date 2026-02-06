using GridSign.Models.DTOs.ResponseDTO;

namespace GridSign.Services.Interfaces;

public interface IFileResourceService
{
    ApiResponse<FileResourceDto> GetFileResourceById(int fileResourceId); 
}