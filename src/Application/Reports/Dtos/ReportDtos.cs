namespace CleanMinimalApi.Application.Reports.Dtos;

using CleanMinimalApi.Application.Alerts;

public sealed record PendingReadingDto(Guid ReadingId, Guid? PropertyId, Guid MeterId, Guid? BillingPeriodId, DateTimeOffset MeasuredAt);

public sealed record AbnormalReadingDto(Guid ReadingId, Guid? PropertyId, Guid MeterId, Guid? BillingPeriodId, List<Alert> Alerts);

public sealed record MonthlySummaryDto(
    Guid BillingPeriodId,
    int ReadingCount,
    int PendingReadingCount,
    int AbnormalReadingCount,
    int MismatchCount,
    decimal? ResidentTotal,
    decimal? CompanyTotal,
    decimal? MismatchPercentage,
    List<UnitConsumptionDto>? TotalsByUnit = null);

public sealed record UnitConsumptionDto(string Unit, decimal? Resident, decimal? Company);
