using GridSign.Data;
using GridSign.Helpers;
using GridSign.Repositories.Auth;
using GridSign.Repositories.UserControl.Interfcae;
using Microsoft.EntityFrameworkCore.Storage;

namespace GridSign.Repositories.RepoHelper;

public class RepoUtility(ApplicationDbContext dbContext)
{
    protected readonly ApplicationDbContext DbContext = dbContext;

    public (bool,IDbContextTransaction) BeginTransaction()
    {
        try
        {
            return (true,DbContext.Database.BeginTransaction());
        }
        catch (Exception e)
        {
            Logger.Logg(LoggLevel.Error, e.Message,e);
        }
        return (false,null)!;
    }
}