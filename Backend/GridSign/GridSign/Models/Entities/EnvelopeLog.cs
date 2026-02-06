namespace GridSign.Models.Entities;

public class EnvelopeLog
{
    public int EnvelopeLogId { get; set; }
    public int EnvelopeId { get; set; }
    public string PerformedAction { get; set; }
    public DateTime PerformedAt { get; set; }
}