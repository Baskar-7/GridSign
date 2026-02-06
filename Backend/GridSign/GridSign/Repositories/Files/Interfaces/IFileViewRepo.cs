using GridSign.Models.Entities;

namespace GridSign.Repositories.Files.Interfaces;

public interface IFileViewRepo
{
    (string status, string message, FileResource? fileResource) GetFileResourceById(int fileResourceId);
}