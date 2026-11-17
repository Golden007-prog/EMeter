namespace CleanMinimalApi.Application.Readings;

using Commands.CreateReading;
using Dtos;
using Entities;

public sealed record UpdateReadingRequest(decimal Value, DateTimeOffset MeasuredAt, int ExpectedVersion, string Reason, Guid? BillingPeriodId = null);
public sealed record ReviewReadingRequest(string Decision, int ExpectedVersion, string Reason);
public sealed record VoidReadingRequest(int ExpectedVersion, string Reason);
public sealed record ReviewReadingCommand(Guid Id, ReviewReadingRequest Request) : MediatR.IRequest<ReadingDto>;
public sealed class ReviewReadingHandler(IReadingWorkflow workflow) : MediatR.IRequestHandler<ReviewReadingCommand, ReadingDto>
{
    public Task<ReadingDto> Handle(ReviewReadingCommand request, CancellationToken cancellationToken) => workflow.ReviewAsync(request.Id, request.Request, cancellationToken);
}
public sealed record ReadingRevisionDto(Guid Id, Guid ReadingId, DateTimeOffset ChangedAt, string Action, string Reason, string? BeforeJson, string AfterJson);

public class ReadingRevision
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ReadingId { get; set; }
    public DateTimeOffset ChangedAt { get; set; } = DateTimeOffset.UtcNow;
    public string Action { get; set; } = "";
    public string Reason { get; set; } = "";
    public string? BeforeJson { get; set; }
    public string AfterJson { get; set; } = "";
}

public interface IReadingWorkflow
{
    Task<CreateReadingResponse> CreateAsync(CreateReadingCommand request, CancellationToken ct);
    Task<ReadingDto> UpdateAsync(Guid id, UpdateReadingRequest request, CancellationToken ct);
    Task<ReadingDto> ReviewAsync(Guid id, ReviewReadingRequest request, CancellationToken ct);
    Task<ReadingDto> VoidAsync(Guid id, VoidReadingRequest request, CancellationToken ct);
    Task<Common.Page<ReadingRevisionDto>> HistoryAsync(Guid id, int page, int pageSize, CancellationToken ct);
    Task AttachAsync(Guid readingId, Guid evidenceId, CancellationToken ct);
}

public static class ReadingTimeline
{
    public static bool IsActive(Reading reading) => reading.ReviewStatus is not ("Rejected" or "Voided");

    public static void Rebuild(IEnumerable<Reading> readings)
    {
        foreach (var group in readings.Where(IsActive).GroupBy(r => new { r.MeterId, r.Source, r.Unit }))
        {
            Reading? previous = null;
            var consumptions = new List<decimal>();
            foreach (var current in group.OrderBy(r => r.MeasuredAt).ThenBy(r => r.Id))
            {
                current.PreviousReadingId = previous?.Id;
                // Keep unchanged alert identities stable when editing another part of the timeline.
                var alerts = previous == null ? [] : Reading.GetAlerts(previous, current, consumptions.Count == 0 ? 0 : consumptions.Average());
                if (!current.Alerts.Select(a => (a.Type, a.Message)).SequenceEqual(alerts.Select(a => (a.Type, a.Message))))
                    current.Alerts = alerts;
                current.Status = current.Alerts.Count > 0 ? "Warning" : current.ReviewStatus;
                if (previous != null)
                {
                    var consumption = Reading.CalculateConsumption(previous, current);
                    if (consumption > 0)
                        consumptions.Add(consumption);
                }
                previous = current;
            }
        }
    }
}
