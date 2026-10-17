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
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var rows = await db.ExtractionJobs.FromSqlInterpolated($"SELECT * FROM \"ExtractionJobs\" WHERE \"Id\" = {id} FOR UPDATE").ToListAsync(ct);
        var job = rows.SingleOrDefault() ?? throw new NotFoundException("Extraction not found");
        if (job.ConfirmedReadingId is { } existing) return new(existing);
        if (job.Status != "NeedsReview") throw new InvalidOperationException("Extraction must be ready for review");
        var result = await sender.Send(new CreateReadingCommand(request.MeterId, request.PropertyId, request.BillingPeriodId,
            null, request.Value, request.Unit, request.MeasuredAt.ToUniversalTime(), request.Source), ct);
        var reading = await db.Readings.SingleAsync(x => x.Id == result.Id, ct);
        reading.EvidenceIds.Add(job.EvidenceId);
        reading.Status = reading.Alerts.Count > 0 ? "Warning" : "Confirmed";
        job.ConfirmedReadingId = reading.Id;
        job.Status = "Confirmed";
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return new(reading.Id);
    }
}
