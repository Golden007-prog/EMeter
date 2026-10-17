namespace CleanMinimalApi.Presentation.Requests;

public sealed record CreateReadingRequest(
    Guid MeterId,
    decimal Value,
    string Unit,
    DateTimeOffset MeasuredAt,
    Guid? PropertyId = null,
    Guid? BillingPeriodId = null,
    Guid? PreviousReadingId = null,
    string Source = "Manual",
    Guid? RequestId = null);
