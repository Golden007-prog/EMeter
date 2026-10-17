namespace CleanMinimalApi.Application.Readings.Commands.CreateReading;

using CleanMinimalApi.Application.Common.Exceptions;
using CleanMinimalApi.Application.Readings.Entities;
using MediatR;
using Serilog;

public sealed class CreateReadingHandler(IReadingsRepository readingsRepository, ILogger logger, Catalog.ICatalogRepository catalog)
    : IRequestHandler<CreateReadingCommand, CreateReadingResponse>
{
    private readonly IReadingsRepository readingsRepository = readingsRepository ?? throw new ArgumentNullException(nameof(readingsRepository));
    private readonly ILogger logger = logger ?? throw new ArgumentNullException(nameof(logger));

    public async Task<CreateReadingResponse> Handle(CreateReadingCommand request, CancellationToken cancellationToken)
    {
        this.logger.Information("Creating reading for meter {MeterId} with value {Value}", request.MeterId, request.Value);

        var meter = await catalog.FindAsync<Meters.Entities.Meter>(request.MeterId, cancellationToken)
            ?? throw new NotFoundException("Meter not found");
        if (meter.Unit != request.Unit || (request.PropertyId != null && meter.PropertyId != request.PropertyId))
            throw new FluentValidation.ValidationException("Meter unit or property does not match");
        if (request.BillingPeriodId is {} periodId)
        {
            var period = await catalog.FindAsync<BillingPeriods.Entities.BillingPeriod>(periodId, cancellationToken)
                ?? throw new NotFoundException("Billing period not found");
            if (period.IsImmutable) throw new InvalidOperationException("Closed billing periods are immutable");
            if (request.MeasuredAt < period.Start || request.MeasuredAt > period.End)
                throw new FluentValidation.ValidationException("Measurement date is outside the billing period");
        }
        var meterReadings = await this.readingsRepository.GetByMeterIdAsync(request.MeterId, cancellationToken);
        if (meterReadings.Any(x => x.Source.Equals(request.Source, StringComparison.OrdinalIgnoreCase) && x.MeasuredAt >= request.MeasuredAt))
            throw new FluentValidation.ValidationException("Readings for the same source must be submitted in chronological order");

        // Find the previous reading for the same source.
        Reading? previousReading;
        if (request.PreviousReadingId.HasValue)
        {
            previousReading = await this.readingsRepository.GetByIdAsync(request.PreviousReadingId.Value, cancellationToken);
            if (previousReading == null)
            {
                throw new NotFoundException($"Previous reading with id {request.PreviousReadingId} not found");
            }
        }
        else
        {
            // Get the latest reading for this meter
            previousReading = meterReadings.Where(x => x.Source.Equals(request.Source, StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(x => x.MeasuredAt).FirstOrDefault();
        }

        if (previousReading != null && (previousReading.MeterId != request.MeterId || previousReading.Unit != request.Unit || !previousReading.Source.Equals(request.Source, StringComparison.OrdinalIgnoreCase)
            || previousReading.MeasuredAt >= request.MeasuredAt))
            throw new FluentValidation.ValidationException("Previous reading must belong to the same meter and unit and have an earlier date");

        var reading = new Reading
        {
            MeterId = request.MeterId,
            PropertyId = meter.PropertyId,
            BillingPeriodId = request.BillingPeriodId,
            PreviousReadingId = previousReading?.Id,
            Value = request.Value,
            Unit = request.Unit,
            MeasuredAt = request.MeasuredAt.ToUniversalTime(),
            Source = request.Source,
            Status = "Pending"
        };

        // Check for consumption anomaly
        if (previousReading != null)
        {
            var historicalReadings = meterReadings.Where(x => x.Source.Equals(request.Source, StringComparison.OrdinalIgnoreCase)).ToList();
            var historicalConsumptions = historicalReadings
                .Where(item => item.PreviousReadingId.HasValue)
                .Select(item => item.Value - (historicalReadings.FirstOrDefault(previous => previous.Id == item.PreviousReadingId)?.Value ?? item.Value))
                .Where(consumption => consumption > 0m)
                .ToList();
            var historicalAverage = historicalConsumptions.Count == 0 ? 0m : historicalConsumptions.Average();
            reading.Alerts.AddRange(Reading.GetAlerts(previousReading, reading, historicalAverage));
            if (reading.Alerts.Count > 0)
            {
                reading.Status = "Warning";
                foreach (var alert in reading.Alerts)
                {
                    this.logger.Warning("Reading alert generated: {Message}", alert.Message);
                }
            }
        }

        await this.readingsRepository.AddAsync(reading, cancellationToken);

        this.logger.Information("Reading created with id {ReadingId}", reading.Id);

        return new CreateReadingResponse(reading.Id, reading.Value, reading.Status);
    }
}
