using GridSign.Data;
using GridSign.Helpers;
using GridSign.Models.Entities;
using GridSign.Repositories.Files.Interfaces;
using GridSign.Repositories.RepoHelper;
using Microsoft.EntityFrameworkCore;

namespace GridSign.Repositories.Files;

public class FileViewRepo(ApplicationDbContext dbContext) :  RepoUtility(dbContext),IFileViewRepo
{
    public (string status,string message,FileResource? fileResource) GetFileResourceById(int fileResourceId)
    {
        var status = "error";
        var message = "An error occured while fetching file!";
        var fileResource = new FileResource();
        try
        {
            fileResource = DbContext.FileResources
                .Include(f => f.UploadedBy)
                .FirstOrDefault(f => f.FileResourceId == fileResourceId);
            status = "success";
            message = "File retrieved successfully!";
        }
        catch (Exception ex)
        {
           Logger.Logg(LoggLevel.Error, ex.Message, ex);
        }

        return (status, message, fileResource);
    }
}