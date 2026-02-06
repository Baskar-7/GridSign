namespace GridSign.Repositories.SigningToken.Interfaces;

public interface ISigningTokenRepository
{
    (string status,string message,string? token) CreateToken(int workflowRecipientId, TimeSpan? ttl = null);
    Models.Entities.SigningToken? GetValidToken(string token);
    Models.Entities.SigningToken? GetActiveTokenForRecipient(int workflowRecipientId);
    (string status,string message,string? token) GetOrReuseToken(int workflowRecipientId, TimeSpan? ttl = null);
    (string status,string message) MarkUsed(int signingTokenId);
}