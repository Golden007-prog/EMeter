namespace CleanMinimalApi.Application.Reports.Queries.GetMonthlySummary;

using CleanMinimalApi.Application.Readings;
using CleanMinimalApi.Application.Reports.Dtos;
using MediatR;

public sealed record GetMonthlySummaryQuery(Guid BillingPeriodId) : IRequest<MonthlySummaryDto>;

public sealed class GetMonthlySummaryHandler(IReadingsRepository readingsRepository)
    : IRequestHandler<GetMonthlySummaryQuery, MonthlySummaryDto>
{
    private readonly IReadingsRepository readingsRepository = readingsRepository ?? throw new ArgumentNullException(nameof(readingsRepository));

    public async Task<MonthlySummaryDto> Handle(GetMonthlySummaryQuery request, CancellationToken cancellationToken)
    {
        var readings = await this.readingsRepository.GetByBillingPeriodIdAsync(request.BillingPeriodId, cancellationToken);
        readings = readings.Where(ReadingTimeline.IsActive).ToList();
        var history = (await this.readingsRepository.GetAllAsync(cancellationToken)).ToDictionary(x => x.Id);
        var calculated = readings.Select(x => new
        {
            Reading = x,
            Consumption = x.PreviousReadingId.HasValue && history.TryGetValue(x.PreviousReadingId.Value, out var previous)
                && ReadingTimeline.IsActive(previous) && previous.MeterId == x.MeterId && previous.Unit == x.Unit
                && previous.Source == x.Source && previous.MeasuredAt < x.MeasuredAt && previous.Value <= x.Value
                    ? (decimal?)(x.Value - previous.Value) : null
        }).ToList();
        // A partial group is unknown, rather than a deceptively complete total.
        var consumptions = calculated.GroupBy(x => new { x.Reading.MeterId, x.Reading.Unit, Source = x.Reading.Source.ToUpperInvariant() })
            .Where(g => g.All(x => x.Consumption.HasValue))
            .Select(g => new { g.Key.MeterId, g.Key.Unit, g.Key.Source, Value = g.Sum(x => x.Consumption!.Value) }).ToList();
        var unknown = calculated.Count(x => !x.Consumption.HasValue);
        var totalsBySource = calculated.GroupBy(x => new { x.Reading.Source, x.Reading.Unit }).Select(g => new SourceConsumptionDto(
            g.Key.Source, g.Key.Unit, g.All(x => x.Consumption.HasValue) ? g.Sum(x => x.Consumption!.Value) : null, g.Count(x => !x.Consumption.HasValue))).ToList();
        bool Complete(string source, string? unit = null) => !calculated.Any(x => !x.Consumption.HasValue && x.Reading.Source.Equals(source, StringComparison.OrdinalIgnoreCase) && (unit == null || x.Reading.Unit == unit));
        var hasResident = consumptions.Any(x => x.Source == "RESIDENT");
        var hasCompany = consumptions.Any(x => x.Source == "COMPANY");
        // Totals are comparable only when their meter sets match.
        var resident = consumptions.Where(x => x.Source == "RESIDENT").Sum(x => x.Value);
        var company = consumptions.Where(x => x.Source == "COMPANY").Sum(x => x.Value);
        var mismatchCount = consumptions.GroupBy(x => x.MeterId).Count(g =>
            g.Any(x => x.Source == "RESIDENT") && g.Any(x => x.Source == "COMPANY") &&
            g.First(x => x.Source == "RESIDENT").Value != g.First(x => x.Source == "COMPANY").Value);
        var sameMeters = consumptions.Where(x => x.Source == "RESIDENT").Select(x => x.MeterId).ToHashSet()
            .SetEquals(consumptions.Where(x => x.Source == "COMPANY").Select(x => x.MeterId));
        var totalsByUnit = consumptions.GroupBy(x => x.Unit).Select(g => new UnitConsumptionDto(g.Key,
            g.Any(x => x.Source == "RESIDENT") && Complete("Resident", g.Key) ? g.Where(x => x.Source == "RESIDENT").Sum(x => x.Value) : null,
            g.Any(x => x.Source == "COMPANY") && Complete("Company", g.Key) ? g.Where(x => x.Source == "COMPANY").Sum(x => x.Value) : null)).ToList();
        var singleUnit = totalsByUnit.Count <= 1;
        decimal? mismatchPercentage = singleUnit && hasResident && hasCompany && Complete("Resident") && Complete("Company") && sameMeters && company != 0
            ? Math.Abs(resident - company) / company * 100 : null;

        return new MonthlySummaryDto(
            request.BillingPeriodId,
            readings.Count,
            readings.Count(reading => reading.ReviewStatus == "Pending"),
            readings.Count(reading => reading.Alerts.Count > 0),
            mismatchCount,
            singleUnit && hasResident && Complete("Resident") ? resident : null,
            singleUnit && hasCompany && Complete("Company") ? company : null,
            mismatchPercentage,
            totalsByUnit, unknown, totalsBySource);
    }
}
