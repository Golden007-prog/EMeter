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
        var history = (await this.readingsRepository.GetAllAsync(cancellationToken)).ToDictionary(x => x.Id);
        var consumptions = readings.Where(x => x.PreviousReadingId.HasValue && history.ContainsKey(x.PreviousReadingId.Value))
            .Select(x => new { x.MeterId, x.Unit, Source = x.Source.ToUpperInvariant(),
                Value = Math.Max(0, x.Value - history[x.PreviousReadingId!.Value].Value) })
            .GroupBy(x => new { x.MeterId, x.Unit, x.Source })
            .Select(g => new { g.Key.MeterId, g.Key.Unit, g.Key.Source, Value = g.Sum(x => x.Value) }).ToList();
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
            g.Any(x => x.Source == "RESIDENT") ? g.Where(x => x.Source == "RESIDENT").Sum(x => x.Value) : null,
            g.Any(x => x.Source == "COMPANY") ? g.Where(x => x.Source == "COMPANY").Sum(x => x.Value) : null)).ToList();
        var singleUnit = totalsByUnit.Count <= 1;
        decimal? mismatchPercentage = singleUnit && hasResident && hasCompany && sameMeters && company != 0
            ? Math.Abs(resident - company) / company * 100 : null;

        return new MonthlySummaryDto(
            request.BillingPeriodId,
            readings.Count,
            readings.Count(reading => reading.Status == "Pending"),
            readings.Count(reading => reading.Alerts.Count > 0),
            mismatchCount,
            singleUnit && hasResident ? resident : null,
            singleUnit && hasCompany ? company : null,
            mismatchPercentage,
            totalsByUnit);
    }
}
