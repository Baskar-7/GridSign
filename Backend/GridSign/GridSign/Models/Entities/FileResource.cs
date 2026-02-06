using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema; 

namespace GridSign.Models.Entities;

public enum FileResourceType
{
    MasterDoc,   
    ToSignDoc,
    SignedDoc,        
    ProofDoc,      
    AttachmentDoc,
    Picture
}

public class FileResource
{
    [Key]
    public int FileResourceId { get; set; } 
    [MaxLength(255)]
    public string? ResourceName { get; set; }
    [Column(TypeName = "MEDIUMBLOB")]
    public byte[]? ResourceData { get; set; }
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;
    [ForeignKey("Users")]
    public Guid UploadedByUserId { get; set; }

    [MaxLength(255)] public FileResourceType FileType = FileResourceType.AttachmentDoc;
    [NotMapped]
    public long ResourceSizeBytes { get; set; } // populated at upload time; mark NotMapped until migration adds column
    
    public Users? UploadedBy { get; set; }
    public ICollection<WorkflowSignatureProof>? SignatureProofs { get; set; }
}

