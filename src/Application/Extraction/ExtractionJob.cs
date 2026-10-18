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

public sealed record ExtractedBill(string Text, Dictionary<string, string> Fields, double? Confidence, string Engine,
    int SchemaVersion = 1, ExtractedDocument? Document = null,
    Dictionary<string, List<ExtractedFieldProposal>>? Proposals = null,
    Dictionary<string, string>? Metadata = null, List<ExtractedReading>? Readings = null,
    List<ExtractedCharge>? Charges = null, List<ExtractedArtifact>? Artifacts = null,
    List<ExtractionWarning>? Warnings = null);

public sealed record ExtractedDocument(string Type, string? Provider, int PageCount, string? DocumentNumber);
public sealed record ExtractedFieldProposal(string Value, string RawValue, string DataType, string Source,
    int? Page, string? Unit, double? Confidence);
public sealed record ExtractedReading(string? MeterNumber, string? Ownership, string? CurrentValue,
    string? PreviousValue, string? Consumption, string? Unit, string? Constant, string? Period, int? Page);
public sealed record ExtractedCharge(string Description, string Amount, string Currency, string? Category, int? Page);
public sealed record ExtractedArtifact(string Type, string? Format, string? Value, string? Title, int Page, string Status);
public sealed record ExtractionWarning(string Code, string Message, string? Field);

public interface IMeterReadingExtractor
{
    Task<ExtractedBill> ExtractAsync(Stream content, string fileName, string contentType, CancellationToken cancellationToken);
}

public interface IExtractionJobs
{
    Task<Common.Page<ExtractionListItem>> ListAsync(string? status, int page, int pageSize, CancellationToken cancellationToken);
    Task<ExtractionStatus> RetryAsync(Guid id, CancellationToken cancellationToken);
    Task<ExtractionJob?> GetAsync(Guid id, CancellationToken cancellationToken);
    Task<ExtractionJob?> ClaimAsync(CancellationToken cancellationToken);
    Task CompleteAsync(ExtractionJob job, ExtractedBill result, CancellationToken cancellationToken);
    Task FailAsync(ExtractionJob job, string errorMessage, CancellationToken cancellationToken);
    Task<CreateConfirmation> ConfirmAsync(Guid id, ConfirmExtractionCommand request, CancellationToken cancellationToken);
}

public sealed record CreateConfirmation(Guid ReadingId);
public sealed record ExtractionListItem(Guid Id, Guid EvidenceId, string FileName, string Status, int Attempts, string? Error, Guid? ConfirmedReadingId, DateTimeOffset AvailableAt);
