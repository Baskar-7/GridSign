namespace GridSign.Models.DTOs.RequestDTO;

public class FieldDto
{ 
    public int FieldId { get; set; }  
    public required string FieldType { get; set; }
    public required string FieldName { get; set; }
    public required string Position { get; set; }
    public bool IsRequired { get; set; }
}