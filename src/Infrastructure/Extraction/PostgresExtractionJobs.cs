namespace CleanMinimalApi.Infrastructure.Extraction;

using Application.Extraction;
using Application.Readings.Commands.CreateReading;
using Application.Common.Exceptions;
using Databases.UtilityMeter;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

internal sealed class PostgresExtractionJobs(UtilityMeterDbContext db, ISender sender) : IExtractionJobs
{
    public async Task<Application.Common.Page<ExtractionListItem>> ListAsync(string? status, int page, int pageSize, CancellationToken ct)
    {
        Application.Common.Paging.Validate(page, pageSize);
        if (status != null && status is not ("Queued" or "Processing" or "NeedsReview" or "Failed" or "Confirmed"))
            throw new FluentValidation.ValidationException("Unknown extraction status");
        var query = from job in db.ExtractionJobs.AsNoTracking()
                    join evidence in db.Evidence.AsNoTracking() on job.EvidenceId equals evidence.Id
                    where status == null || job.Status == status
                    select new { job.Id, job.EvidenceId, evidence.FileName, job.Status, job.Attempts, job.Error, job.ConfirmedReadingId, job.AvailableAt };
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(x => x.AvailableAt).ThenBy(x => x.Id).Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return new(items.Select(x => new ExtractionListItem(x.Id, x.EvidenceId, x.FileName, x.Status, x.Attempts, x.Error, x.ConfirmedReadingId, x.AvailableAt)).ToList(), page, pageSize, total);
    }
    public async Task<ExtractionStatus> RetryAsync(Guid id, CancellationToken ct)
    {
        var job = await GetAsync(id, ct) ?? throw new NotFoundException("Extraction not found");
        if (job.Status != "Failed")
            throw new ConflictException("Only failed extractions can be retried");
        if (db.Database.IsRelational())
        {
            var count = await db.ExtractionJobs.Where(x => x.Id == id && x.Status == "Failed" && x.ConfirmedReadingId == null)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, "Queued").SetProperty(x => x.Attempts, 0)
                .SetProperty(x => x.AvailableAt, DateTimeOffset.UtcNow).SetProperty(x => x.Error, (string?)null)
                .SetProperty(x => x.ResultJson, (string?)null).SetProperty(x => x.LeaseUntil, (DateTimeOffset?)null).SetProperty(x => x.LeaseToken, (Guid?)null), ct);
            if (count != 1)
                throw new ConflictException("Extraction changed; reload it before retrying");
        }
        else
        {
            var tracked = await db.ExtractionJobs.SingleAsync(x => x.Id == id, ct);
            tracked.Status = "Queued";
            tracked.Attempts = 0;
            tracked.AvailableAt = DateTimeOffset.UtcNow;
            tracked.Error = null;
            tracked.ResultJson = null;
            tracked.LeaseUntil = null;
            tracked.LeaseToken = null;
            await db.SaveChangesAsync(ct);
        }
        return await new GetExtractionHandler(this).Handle(new(id), ct);
    }
    public Task<ExtractionJob?> GetAsync(Guid id, CancellationToken ct) => db.ExtractionJobs.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);

    public async Task<ExtractionJob?> ClaimAsync(CancellationToken ct)
    {
        // One atomic UPDATE: multiple workers cannot acquire the same lease.
        var token = Guid.NewGuid();
        var rows = await db.ExtractionJobs.FromSqlInterpolated($"""
            UPDATE "ExtractionJobs" SET "Status" = 'Processing', "Attempts" = "Attempts" + 1,
                "LeaseUntil" = NOW() + INTERVAL '10 minutes', "LeaseToken" = {token}
            WHERE "Id" = (
                SELECT "Id" FROM "ExtractionJobs"
                WHERE ("Status" = 'Queued' AND "AvailableAt" <= NOW())
                   OR ("Status" = 'Processing' AND "LeaseUntil" < NOW() AND "Attempts" < 3)
                ORDER BY "AvailableAt" FOR UPDATE SKIP LOCKED LIMIT 1
            ) RETURNING *
            """).AsNoTracking().ToListAsync(ct);
        await db.ExtractionJobs.Where(x => x.Status == "Processing" && x.LeaseUntil < DateTimeOffset.UtcNow && x.Attempts >= 3)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, "Failed").SetProperty(x => x.Error, "Worker lease expired after maximum attempts"), ct);
        return rows.SingleOrDefault();
    }

    public async Task CompleteAsync(ExtractionJob job, ExtractedBill result, CancellationToken ct)
    {
        var json = JsonSerializer.Serialize(result);
        await db.ExtractionJobs.Where(x => x.Id == job.Id && x.LeaseToken == job.LeaseToken && x.Status == "Processing")
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, "NeedsReview").SetProperty(x => x.ResultJson, json)
                .SetProperty(x => x.Error, (string?)null).SetProperty(x => x.LeaseUntil, (DateTimeOffset?)null), ct);
    }

    public async Task FailAsync(ExtractionJob job, string error, CancellationToken ct)
    {
        var status = job.Attempts >= 3 ? "Failed" : "Queued";
        var available = DateTimeOffset.UtcNow.AddSeconds(10 * job.Attempts);
        await db.ExtractionJobs.Where(x => x.Id == job.Id && x.LeaseToken == job.LeaseToken && x.Status == "Processing")
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, status).SetProperty(x => x.Error, error.Substring(0, Math.Min(error.Length, 2000)))
                .SetProperty(x => x.AvailableAt, available).SetProperty(x => x.LeaseUntil, (DateTimeOffset?)null), ct);
    }

    public async Task<CreateConfirmation> ConfirmAsync(Guid id, ConfirmExtractionCommand request, CancellationToken ct)
    {
        await using var transaction = db.Database.IsRelational() ? await db.Database.BeginTransactionAsync(ct) : null;
        var rows = db.Database.IsNpgsql()
            ? await db.ExtractionJobs.FromSqlInterpolated($"SELECT * FROM \"ExtractionJobs\" WHERE \"Id\" = {id} FOR UPDATE").ToListAsync(ct)
            : await db.ExtractionJobs.Where(x => x.Id == id).ToListAsync(ct);
        var job = rows.SingleOrDefault() ?? throw new NotFoundException("Extraction not found");
        if (job.ConfirmedReadingId is { } existing)
            return new(existing);
        if (job.Status != "NeedsReview")
            throw new ConflictException("Extraction must be ready for review");
        var result = await sender.Send(new CreateReadingCommand(request.MeterId, request.PropertyId, request.BillingPeriodId,
            null, request.Value, request.Unit, request.MeasuredAt.ToUniversalTime(), request.Source), ct);
        var reading = await db.Readings.SingleAsync(x => x.Id == result.Id, ct);
        await sender.Send(new Application.Readings.ReviewReadingCommand(reading.Id,
            new("Confirmed", reading.Version, "OCR values reviewed and confirmed")), ct);
        await sender.Send(new Application.Evidence.Commands.AttachEvidenceToReading.AttachEvidenceToReadingCommand(reading.Id, job.EvidenceId), ct);
        job.ConfirmedReadingId = reading.Id;
        job.Status = "Confirmed";
        await db.SaveChangesAsync(ct);
        if (transaction != null)
            await transaction.CommitAsync(ct);
        return new(reading.Id);
    }
}
