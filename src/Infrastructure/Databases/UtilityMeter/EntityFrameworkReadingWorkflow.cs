namespace CleanMinimalApi.Infrastructure.Databases.UtilityMeter;

using System.Text.Json;
using Application.Common;
using Application.Common.Exceptions;
using Application.Readings;
using Application.Readings.Commands.CreateReading;
using Application.Readings.Dtos;
using Application.Readings.Entities;
using Application.Readings.Mappings;
using FluentValidation;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

internal sealed class EntityFrameworkReadingWorkflow(UtilityMeterDbContext db) : IReadingWorkflow
{
    private static string Snapshot(Reading r) => JsonSerializer.Serialize(r.ToDto());
    private static void Reason(string reason)
    {
        if (string.IsNullOrWhiteSpace(reason) || reason.Length > 1000)
            throw new ValidationException("A reason of 1 to 1000 characters is required");
    }
    private static void Value(decimal value)
    {
        if (value < 0 || value >= 10000000000000000m || decimal.Round(value, 2) != value)
            throw new ValidationException("Reading must be non-negative, below 10^16, with at most two decimal places");
    }
    private async Task<IDbContextTransaction?> Begin(CancellationToken ct) => db.Database.IsRelational() && db.Database.CurrentTransaction == null
        ? await db.Database.BeginTransactionAsync(ct) : null;

    private async Task LockMeter(Guid id, CancellationToken ct)
    {
        if (db.Database.IsNpgsql())
        {
            var rows = await db.Meters.FromSqlInterpolated($"SELECT * FROM \"Meters\" WHERE \"Id\" = {id} FOR UPDATE").AsNoTracking().ToListAsync(ct);
            if (rows.Count == 0)
                throw new NotFoundException("Meter not found");
        }
        else if (!await db.Meters.AnyAsync(x => x.Id == id, ct))
            throw new NotFoundException("Meter not found");
    }
    private async Task Mutable(Guid? periodId, DateTimeOffset? measuredAt, CancellationToken ct)
    {
        if (periodId == null)
            return;
        var period = db.Database.IsNpgsql()
            ? (await db.BillingPeriods.FromSqlInterpolated($"SELECT * FROM \"BillingPeriods\" WHERE \"Id\" = {periodId} FOR SHARE").AsNoTracking().ToListAsync(ct)).SingleOrDefault()
            : await db.BillingPeriods.AsNoTracking().SingleOrDefaultAsync(x => x.Id == periodId, ct);
        if (period == null)
            throw new NotFoundException("Billing period not found");
        if (period.IsImmutable)
            throw new ConflictException("Change would affect a closed billing period");
        if (measuredAt.HasValue && (measuredAt < period.Start || measuredAt > period.End))
            throw new ValidationException("Measurement date is outside the billing period");
    }
    private async Task<List<Reading>> Timeline(Guid meterId, CancellationToken ct) =>
        await db.Readings.Where(x => x.MeterId == meterId).Include(x => x.Alerts).ToListAsync(ct);

    private void Audit(Reading r, string? before, string action, string reason)
    {
        db.ReadingRevisions.Add(new ReadingRevision { ReadingId = r.Id, BeforeJson = before, AfterJson = Snapshot(r), Action = action, Reason = reason });
    }
    private async Task SaveTimeline(List<Reading> timeline, Dictionary<Guid, string> before, Guid target, string action, string reason, CancellationToken ct)
    {
        var source = timeline.Single(x => x.Id == target).Source;
        ReadingTimeline.Rebuild(timeline.Where(x => x.Source == source));
        foreach (var r in timeline)
        {
            before.TryGetValue(r.Id, out var old);
            if (old == Snapshot(r))
                continue;
            await Mutable(r.BillingPeriodId, r.MeasuredAt, ct);
            if (old != null)
                r.Version++;
            Audit(r, old, r.Id == target ? action : "Recalculated", reason);
        }
        await db.SaveChangesAsync(ct);
    }

    public async Task<CreateReadingResponse> CreateAsync(CreateReadingCommand request, CancellationToken ct)
    {
        // Also validate when invoked directly by the OCR infrastructure.
        await new CreateReadingValidator().ValidateAndThrowAsync(request, ct);
        Value(request.Value);
        await using var transaction = await Begin(ct);
        await LockMeter(request.MeterId, ct);
        var timeline = await Timeline(request.MeterId, ct);
        if (request.RequestId is { } key)
        {
            var replay = await db.Readings.FindAsync([key], ct);
            if (replay != null)
            {
                if (replay.MeterId != request.MeterId || replay.Value != request.Value || replay.Unit != request.Unit || replay.Source != request.Source || replay.MeasuredAt != request.MeasuredAt || replay.BillingPeriodId != request.BillingPeriodId || (request.PropertyId != null && replay.PropertyId != request.PropertyId))
                    throw new ConflictException("RequestId already used with different reading values");
                return new(replay.Id, replay.Value, replay.Status);
            }
        }
        var meter = await db.Meters.AsNoTracking().SingleAsync(x => x.Id == request.MeterId, ct);
        if (meter.Unit != request.Unit || (request.PropertyId != null && meter.PropertyId != request.PropertyId))
            throw new ValidationException("Meter unit or property does not match");
        await Mutable(request.BillingPeriodId, request.MeasuredAt, ct);
        if (timeline.Any(x => ReadingTimeline.IsActive(x) && x.Source == request.Source && x.MeasuredAt == request.MeasuredAt))
            throw new ConflictException("A reading already exists for this meter, source and measurement time");
        var previous = timeline.Where(x => ReadingTimeline.IsActive(x) && x.Source == request.Source && x.MeasuredAt < request.MeasuredAt).OrderByDescending(x => x.MeasuredAt).FirstOrDefault();
        if (request.PreviousReadingId.HasValue && request.PreviousReadingId != previous?.Id)
            throw new ValidationException("PreviousReadingId must be the immediately preceding active reading of this meter and source");
        var before = timeline.ToDictionary(x => x.Id, Snapshot);
        var reading = new Reading
        {
            Id = request.RequestId ?? Guid.NewGuid(),
            MeterId = meter.Id,
            PropertyId = meter.PropertyId,
            BillingPeriodId = request.BillingPeriodId,
            Value = request.Value,
            Unit = meter.Unit,
            MeasuredAt = request.MeasuredAt.ToUniversalTime(),
            Source = request.Source
        };
        timeline.Add(reading);
        db.Readings.Add(reading);
        await SaveTimeline(timeline, before, reading.Id, "Created", "Reading registered", ct);
        if (transaction != null)
            await transaction.CommitAsync(ct);
        return new(reading.Id, reading.Value, reading.Status);
    }

    private async Task<ReadingDto> Change(Guid id, int version, string reason, string action, Func<Reading, Task> change, CancellationToken ct)
    {
        Reason(reason);
        await using var transaction = await Begin(ct);
        var meterId = await db.Readings.Where(x => x.Id == id).Select(x => (Guid?)x.MeterId).SingleOrDefaultAsync(ct) ?? throw new NotFoundException("Reading not found");
        await LockMeter(meterId, ct);
        var timeline = await Timeline(meterId, ct);
        var reading = timeline.Single(x => x.Id == id);
        if (reading.Version != version)
            throw new ConflictException("Reading changed; reload it before saving");
        if (reading.ReviewStatus == "Voided")
            throw new ConflictException("Voided readings are immutable");
        await Mutable(reading.BillingPeriodId, reading.MeasuredAt, ct);
        var before = timeline.ToDictionary(x => x.Id, Snapshot);
        await change(reading);
        if (ReadingTimeline.IsActive(reading) && timeline.Any(x => x.Id != id && ReadingTimeline.IsActive(x) && x.Source == reading.Source && x.MeasuredAt == reading.MeasuredAt))
            throw new ConflictException("A reading already exists for this source and measurement time");
        await SaveTimeline(timeline, before, id, action, reason.Trim(), ct);
        if (transaction != null)
            await transaction.CommitAsync(ct);
        return reading.ToDto();
    }
    public Task<ReadingDto> UpdateAsync(Guid id, UpdateReadingRequest request, CancellationToken ct) =>
        Change(id, request.ExpectedVersion, request.Reason, "Corrected", async r =>
        {
            Value(request.Value);
            if (request.MeasuredAt == default)
                throw new ValidationException("Measurement date is required");
            await Mutable(request.BillingPeriodId, request.MeasuredAt, ct);
            r.Value = request.Value;
            r.MeasuredAt = request.MeasuredAt.ToUniversalTime();
            r.BillingPeriodId = request.BillingPeriodId;
            r.ReviewStatus = "Pending";
        }, ct);
    public Task<ReadingDto> ReviewAsync(Guid id, ReviewReadingRequest request, CancellationToken ct) =>
        Change(id, request.ExpectedVersion, request.Reason, "Reviewed", r =>
        {
            if (request.Decision is not ("Confirmed" or "Rejected"))
                throw new ValidationException("Decision must be Confirmed or Rejected");
            r.ReviewStatus = request.Decision;
            r.Status = request.Decision;
            if (request.Decision == "Rejected")
            { r.PreviousReadingId = null; r.Alerts.Clear(); }
            return Task.CompletedTask;
        }, ct);
    public Task<ReadingDto> VoidAsync(Guid id, VoidReadingRequest request, CancellationToken ct) =>
        Change(id, request.ExpectedVersion, request.Reason, "Voided", r =>
        { r.ReviewStatus = "Voided"; r.Status = "Voided"; r.PreviousReadingId = null; r.Alerts.Clear(); return Task.CompletedTask; }, ct);

    public async Task<Page<ReadingRevisionDto>> HistoryAsync(Guid id, int page, int pageSize, CancellationToken ct)
    {
        Paging.Validate(page, pageSize);
        if (!await db.Readings.AnyAsync(x => x.Id == id, ct))
            throw new NotFoundException("Reading not found");
        var query = db.ReadingRevisions.AsNoTracking().Where(x => x.ReadingId == id);
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(x => x.ChangedAt).ThenBy(x => x.Id).Skip((page - 1) * pageSize).Take(pageSize)
            .Select(x => new ReadingRevisionDto(x.Id, x.ReadingId, x.ChangedAt, x.Action, x.Reason, x.BeforeJson, x.AfterJson)).ToListAsync(ct);
        return new(items, page, pageSize, total);
    }
    public async Task AttachAsync(Guid readingId, Guid evidenceId, CancellationToken ct)
    {
        await using var transaction = await Begin(ct);
        var meterId = await db.Readings.Where(x => x.Id == readingId).Select(x => (Guid?)x.MeterId).SingleOrDefaultAsync(ct) ?? throw new NotFoundException("Reading not found");
        await LockMeter(meterId, ct);
        var reading = await db.Readings.Include(x => x.Alerts).SingleAsync(x => x.Id == readingId, ct);
        if (!await db.Evidence.AnyAsync(x => x.Id == evidenceId, ct))
            throw new NotFoundException("Evidence not found");
        if (reading.EvidenceIds.Contains(evidenceId))
            return;
        await Mutable(reading.BillingPeriodId, null, ct);
        if (!ReadingTimeline.IsActive(reading))
            throw new ConflictException("Cannot attach evidence to a rejected or voided reading");
        var before = Snapshot(reading);
        reading.EvidenceIds.Add(evidenceId);
        reading.Version++;
        Audit(reading, before, "EvidenceAttached", "Evidence " + evidenceId);
        await db.SaveChangesAsync(ct);
        if (transaction != null)
            await transaction.CommitAsync(ct);
    }
}
