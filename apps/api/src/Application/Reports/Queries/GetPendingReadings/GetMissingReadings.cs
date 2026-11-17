namespace CleanMinimalApi.Application.Reports.Queries.GetPendingReadings;

using Catalog;
using Common.Exceptions;
using MediatR;
using Meters.Entities;
using Readings;

public sealed record MissingReadingDto(Guid MeterId, Guid PropertyId, Guid BillingPeriodId, string Unit, string SerialNumber);
public sealed record GetMissingReadingsQuery(Guid BillingPeriodId, Guid? PropertyId = null) : IRequest<List<MissingReadingDto>>;
public sealed class GetMissingReadingsHandler(ICatalogRepository catalog, IReadingsRepository readings)
    : IRequestHandler<GetMissingReadingsQuery, List<MissingReadingDto>>
{
    public async Task<List<MissingReadingDto>> Handle(GetMissingReadingsQuery request, CancellationToken cancellationToken)
    {
        if (await catalog.FindAsync<BillingPeriods.Entities.BillingPeriod>(request.BillingPeriodId, cancellationToken) == null)
            throw new NotFoundException("Billing period not found");
        var present = (await readings.GetByBillingPeriodIdAsync(request.BillingPeriodId, cancellationToken)).Where(ReadingTimeline.IsActive).Select(x => x.MeterId).ToHashSet();
        return (await catalog.ListAsync<Meter>(cancellationToken))
            .Where(x => (request.PropertyId == null || x.PropertyId == request.PropertyId) && !present.Contains(x.Id))
            .Select(x => new MissingReadingDto(x.Id, x.PropertyId, request.BillingPeriodId, x.Unit, x.SerialNumber)).ToList();
    }
}
