using Microsoft.EntityFrameworkCore.Storage;

namespace GridSign.Repositories.RepoHelper.Interfaces;

public interface IRepoUtility
{
    (bool isTransanctionCreated, IDbContextTransaction transaction) BeginTransaction();
}