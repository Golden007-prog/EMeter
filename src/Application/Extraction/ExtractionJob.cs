namespace CleanMinimalApi.Application.Extraction;

public sealed class ExtractionJob
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid EvidenceId { get; set; }
    public string Status { get; set; } = "Queued";
    public int Attempts { get; set; }
    public DateTimeOffset AvailableAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? LeaseUntil { get; set; }
    public Guid? LeaseToken { get; set; }
    public string? Error { get; set; }
    public string? ResultJson { get; set; }
    public Guid? ConfirmedReadingId { get; set; }
}

public sealed record ExtractedBill(string Text, Dictionary<string, string> Fields, double? Confidence, string Engine);

public interface IMeterReadingExtractor
{
    Task<ExtractedBill> ExtractAsync(Stream content, string fileName, string contentType, CancellationToken cancellationToken);
}

public interface IExtractionJobs
{
    Task<ExtractionJob?> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<ExtractionJob?> ClaimAsync(CancellationToken cancellationToken);
    Task CompleteAsync(ExtractionJob job, ExtractedBill result, CancellationToken cancellationToken);
    Task FailAsync(ExtractionJob job, string errorMessage, CancellationToken cancellationToken);
    Task<CreateConfirmation> ConfirmAsync(Guid id, ConfirmExtractionCommand request, CancellationToken cancellationToken);
}

public sealed record CreateConfirmation(Guid ReadingId);
