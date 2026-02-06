using GridSign.Helpers;
using GridSign.Models.DTOs.ResponseDTO; 
using GridSign.Repositories.Files.Interfaces;
using GridSign.Services.Interfaces;
using GridSign.Services.ServiceHelper; 

namespace GridSign.Services;

public class FileResourceService(IFileViewRepo fileViewRepo) : ServiceUtility,IFileResourceService
{
    public ApiResponse<FileResourceDto> GetFileResourceById(int fileResourceId)
    {
        var apiResponse = new ApiResponse<FileResourceDto>();
        try
        {
             var (status, message,file) = fileViewRepo.GetFileResourceById(fileResourceId);
            
            if (status.Equals("error") || file == null)
            { 
                apiResponse.Message = $"File resource with id {fileResourceId} not found.";
                return apiResponse;
            }

            if (file.ResourceData == null || file.ResourceData.Length == 0)
            {
                apiResponse.Message = "FileResource {FileId} has empty data (null or zero length)";
                return apiResponse;
            }

            // Determine content type - for now assuming PDF, extend as needed
            var contentType = DetectContentType(file.ResourceName, file.ResourceData) ?? "application/octet-stream";
            var extension = GuessExtension(contentType) ?? "bin";
            var filename = file.ResourceName;
            if (string.IsNullOrWhiteSpace(filename)) 
                filename = $"file-{fileResourceId}.{extension}";
            else if (!filename!.Contains('.', StringComparison.Ordinal)) 
                filename += $".{extension}";

            apiResponse.Data = new  FileResourceDto
            {
                ResourceData = file.ResourceData,
                ContentType =contentType, 
                FileName = filename
            };
            apiResponse.Status = status;
            apiResponse.Message = message;
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, "Error getting file resource",e);
        }
        return apiResponse;
    }
}