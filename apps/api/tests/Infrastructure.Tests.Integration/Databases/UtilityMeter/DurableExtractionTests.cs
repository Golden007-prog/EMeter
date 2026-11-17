namespace CleanMinimalApi.Infrastructure.Tests.Integration.Databases.UtilityMeter;

using Application.Extraction;
using Infrastructure.Databases.UtilityMeter;
using Infrastructure.Extraction;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using CleanMinimalApi.Application;
using NSubstitute;
using Shouldly;
using Testcontainers.PostgreSql;
using Xunit;

public class DurableExtractionTests
{
    [Fact]
    public async Task PostgresQueue_ShouldLeaseExclusivelyRecoverExpiredWorkAndFenceStaleWorkers()
    {
        await using var postgres = new PostgreSqlBuilder().WithImage("postgres:17-alpine").Build();
        await postgres.StartAsync();
        var options = new DbContextOptionsBuilder<UtilityMeterDbContext>().UseNpgsql(postgres.GetConnectionString()).Options;
        await using var first = new UtilityMeterDbContext(options);
        await first.Database.MigrateAsync();
        var evidence = new Application.Evidence.Entities.Evidence { FileName = "bill.pdf", StorageKey = "test", Hash = "hash" };
        var job = new ExtractionJob { EvidenceId = evidence.Id };
        first.Evidence.Add(evidence);
        first.ExtractionJobs.Add(job);
        await first.SaveChangesAsync();
        await using var second = new UtilityMeterDbContext(options);
        var queue1 = new PostgresExtractionJobs(first, Substitute.For<ISender>());
        var queue2 = new PostgresExtractionJobs(second, Substitute.For<ISender>());
        var claims = await Task.WhenAll(queue1.ClaimAsync(default), queue2.ClaimAsync(default));
        claims.Count(x => x != null).ShouldBe(1);
        var oldLease = claims.Single(x => x != null)!;
        oldLease.Attempts.ShouldBe(1);
        await first.ExtractionJobs.Where(x => x.Id == job.Id).ExecuteUpdateAsync(s => s.SetProperty(x => x.LeaseUntil, DateTimeOffset.UtcNow.AddMinutes(-1)));
        var recovered = await queue2.ClaimAsync(default);
        recovered.ShouldNotBeNull();
        recovered.Attempts.ShouldBe(2);
        recovered.LeaseToken.ShouldNotBe(oldLease.LeaseToken);
        await queue1.CompleteAsync(oldLease, new("stale", [], null, "test"), default);
        (await queue1.GetAsync(job.Id, default))!.Status.ShouldBe("Processing");
        await queue2.FailAsync(recovered, "temporary failure", default);
        (await queue1.GetAsync(job.Id, default))!.Status.ShouldBe("Queued");
        (await queue1.ClaimAsync(default)).ShouldBeNull(); // Retry backoff is respected.
        await first.ExtractionJobs.Where(x => x.Id == job.Id).ExecuteUpdateAsync(s => s.SetProperty(x => x.AvailableAt, DateTimeOffset.UtcNow.AddSeconds(-1)));
        var lastLease = await queue1.ClaimAsync(default);
        lastLease.ShouldNotBeNull();
        lastLease.Attempts.ShouldBe(3);
        await queue1.FailAsync(lastLease, "permanent failure", default);
        (await queue1.GetAsync(job.Id, default))!.Status.ShouldBe("Failed");
        (await queue2.ClaimAsync(default)).ShouldBeNull();
        var inbox = await queue1.ListAsync("Failed", 1, 50, default);
        inbox.Items.Single().FileName.ShouldBe("bill.pdf");
        var retry = await queue1.RetryAsync(job.Id, default);
        retry.Status.ShouldBe("Queued");
        retry.Attempts.ShouldBe(0);
        retry.Error.ShouldBeNull();
        await Should.ThrowAsync<InvalidOperationException>(() => queue2.RetryAsync(job.Id, default));
        await queue1.CompleteAsync(lastLease, new("stale", [], null, "test"), default);
        (await queue1.GetAsync(job.Id, default))!.Status.ShouldBe("Queued");

        // A reviewed proposal creates exactly one reading, including under concurrent confirmation.
        await first.ExtractionJobs.Where(x => x.Id == job.Id).ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, "NeedsReview"));
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["ConnectionStrings:UtilityMeter"] = postgres.GetConnectionString()
        }).Build();
        var services = new ServiceCollection();
        services.AddInfrastructure(configuration).AddApplication();
        services.AddSingleton<Serilog.ILogger>(Serilog.Log.Logger);
        await using var provider = services.BuildServiceProvider();
        Guid meterId;
        using (var setup = provider.CreateScope())
        {
            var sender = setup.ServiceProvider.GetRequiredService<ISender>();
            var property = await sender.Send(new Application.Catalog.CreateProperty("Casa", "Santiago", Application.Common.Enums.ResourceType.Electricity, null, null));
            var meter = await sender.Send(new Application.Catalog.CreateMeter(property.Id, "test", Application.Common.Enums.ResourceType.Electricity, "kWh", ""));
            meterId = meter.Id;
        }
        async Task<CreateConfirmation> Confirm()
        {
            using var scope = provider.CreateScope();
            return await scope.ServiceProvider.GetRequiredService<ISender>().Send(new ConfirmExtractionCommand(job.Id, meterId, null, null, 100, "kWh", DateTimeOffset.UtcNow));
        }
        var confirmations = await Task.WhenAll(Confirm(), Confirm());
        confirmations[0].ReadingId.ShouldBe(confirmations[1].ReadingId);
        first.ChangeTracker.Clear();
        var reading = await first.Readings.SingleAsync();
        reading.EvidenceIds.ShouldContain(evidence.Id);
        reading.Status.ShouldBe("Confirmed");
        (await queue1.GetAsync(job.Id, default))!.Status.ShouldBe("Confirmed");
    }
}
