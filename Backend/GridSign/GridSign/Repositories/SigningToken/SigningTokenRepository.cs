using GridSign.Data;
using GridSign.Helpers;
using GridSign.Repositories.RepoHelper;
using GridSign.Repositories.SigningToken.Interfaces; 
namespace GridSign.Repositories.SigningToken;

public class SigningTokenRepository(ApplicationDbContext dbContext) : RepoUtility(dbContext), ISigningTokenRepository
{
    public (string status,string message,string? token) CreateToken(int workflowRecipientId, TimeSpan? ttl = null)
    {
        var status = "error"; var message = "Failed creating signing token"; string? token = null;
        try
        {
            var expiry = DateTime.UtcNow.Add(ttl ?? TimeSpan.FromMinutes(60));
            token = Guid.NewGuid().ToString("N");
            var entity = new Models.Entities.SigningToken { WorkflowRecipientId = workflowRecipientId, Token = token, ExpiresAt = expiry, IsUsed = false };
            DbContext.Add(entity);
            DbContext.SaveChanges();
            status = "success"; message = "Signing token created";
        }
        catch(Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return (status,message,token);
    }

    public Models.Entities.SigningToken? GetValidToken(string token)
    {
        try
        {
            var record = DbContext.Set<Models.Entities.SigningToken>().FirstOrDefault(t => t.Token == token);
            if (record == null) return null;
            if (record.IsUsed) return null;
            if (record.ExpiresAt < DateTime.UtcNow) return null;
            return record;
        }
        catch(Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
            return null;
        }
    }

    public Models.Entities.SigningToken? GetActiveTokenForRecipient(int workflowRecipientId)
    {
        try
        {
            var now = DateTime.UtcNow;
            return DbContext.Set<Models.Entities.SigningToken>()
                .Where(t => t.WorkflowRecipientId == workflowRecipientId && !t.IsUsed && t.ExpiresAt > now)
                .OrderByDescending(t => t.ExpiresAt)
                .FirstOrDefault();
        }
        catch(Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
            return null;
        }
    }

    public (string status,string message,string? token) GetOrReuseToken(int workflowRecipientId, TimeSpan? ttl = null)
    {
        var existing = GetActiveTokenForRecipient(workflowRecipientId);
        if (existing != null)
            return ("success","Existing active token reused", existing.Token);
        return CreateToken(workflowRecipientId, ttl);
    }

    public (string status,string message) MarkUsed(int signingTokenId)
    {
        var status = "error"; var message = "Failed to mark token used";
        try
        {
            var record = DbContext.Set<Models.Entities.SigningToken>().FirstOrDefault(t => t.SigningTokenId == signingTokenId);
            if (record == null) { message = "Token not found"; return (status,message); }
            record.IsUsed = true; DbContext.Update(record); DbContext.SaveChanges();
            status = "success"; message = "Token marked used";
        }
        catch(Exception e)
        {
            Logger.Logg(LoggLevel.Error,e.Message,e);
        }
        return (status,message);
    }
}