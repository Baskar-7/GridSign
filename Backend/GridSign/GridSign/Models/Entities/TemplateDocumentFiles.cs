using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace GridSign.Models.Entities;

public class TemplateDocumentFiles
{
    [Key]
    public int Id { get; set; }
    [ForeignKey("Document")]
    public int DocumentId { get; set; }
    [ForeignKey("FileResource")]
    public int FileResourceId { get; set; }
 
    public TemplateDocument? Document { get; set; }
    public FileResource? File { get; set; }
}