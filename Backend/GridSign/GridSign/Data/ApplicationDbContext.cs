using GridSign.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace GridSign.Data; 

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    public DbSet<Users> Users { get; set; } 
    public DbSet<Image> Images { get; set; }
    public DbSet<TemplateRecipient> TemplateRecipient { get; set; } 
    public DbSet<TemplateRecipientRole> RecipientRole { get; set; }
    public DbSet<Workflow> Workflow { get; set; }
    public DbSet<WorkflowEnvelope>  WorkflowEnvelope { get; set; }
    public DbSet<WorkflowRecipient> WorkflowRecipient { get; set; }
    public DbSet<WorkflowRecipientSignature> WorkflowRecipientSignature { get; set; }
    public DbSet<WorkflowRecipientSignedDocument> WorkflowRecipientSignedDocument { get; set; }
    public DbSet<SignedDocumentVersion>  SignedDocumentVersion { get; set; }
    public DbSet<WorkflowSignatureProof> SignatureProof { get; set; }
    
    public DbSet<Template> Template { get; set; }
    public DbSet<TemplateDocument> Documents { get; set; }
    public DbSet<Field> Fields { get; set; }
    public DbSet<TemplateRecipientField> TemplateRecipientFields { get; set; }
    public DbSet<FileResource> FileResources { get; set; }
    public DbSet<TemplateDocumentFiles> DocumentAttachments { get; set; }
    
     
    public DbSet<Verification> Verification { get; set; }
    public DbSet<Notification> Notifications { get; set; }
    public DbSet<EnvelopeLog> EnvelopeLog { get; set; }
    public DbSet<SigningToken> SigningTokens { get; set; }
    
    
}