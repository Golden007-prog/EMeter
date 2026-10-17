namespace CleanMinimalApi.Infrastructure.Tests.Integration.Databases.UtilityMeter;

using Application;
using Application.Catalog;
using Application.Common.Enums;
using Application.Readings;
using Application.Readings.Commands.CreateReading;
using Application.Readings.Dtos;
using Application.Reports.Queries.GetMonthlySummary;
using Infrastructure.Databases.UtilityMeter;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Shouldly;
using Testcontainers.PostgreSql;
using Xunit;

public class ReadingWorkflowTests
{
    [Fact]
    public async Task MigrationPreservesExistingReadingsAndTheirReviewState()
    {
        await using var postgres = new PostgreSqlBuilder().WithImage("postgres:17-alpine").Build();
        await postgres.StartAsync();
        await using var db = new UtilityMeterDbContext(new DbContextOptionsBuilder<UtilityMeterDbContext>().UseNpgsql(postgres.GetConnectionString()).Options);
        var migrator = Microsoft.EntityFrameworkCore.Infrastructure.AccessorExtensions.GetService<Microsoft.EntityFrameworkCore.Migrations.IMigrator>(db);
        await migrator.MigrateAsync("20261015054610_InitialPersistentSchema");
        var manual = Guid.NewGuid();
        var confirmed = Guid.NewGuid();
        var meter = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;
        await db.Database.ExecuteSqlInterpolatedAsync($"""
            INSERT INTO "Readings" ("Id", "MeterId", "Value", "Unit", "MeasuredAt", "Source", "Status", "EvidenceIds")
            VALUES ({manual}, {meter}, 100, 'm3', {now}, 'Manual', 'Pending', ''),
                   ({confirmed}, {meter}, 120, 'm3', {now}, 'Company', 'Confirmed', '');
            """);
        await db.Database.MigrateAsync();
        var readings = await db.Readings.ToListAsync();
        readings.Count.ShouldBe(2);
        readings.Single(x => x.Id == manual).Value.ShouldBe(100);
        readings.Single(x => x.Id == manual).ReviewStatus.ShouldBe("Pending");
        readings.Single(x => x.Id == confirmed).ReviewStatus.ShouldBe("Confirmed");
        readings.ShouldAllBe(x => x.Version == 1);
        db.Database.HasPendingModelChanges().ShouldBeFalse();
    }

    [Fact]
    public async Task PostgresPersistsAuditRecalculatesAlertsAndSerializesConcurrentSubmissions()
    {
        await using var postgres = new PostgreSqlBuilder().WithImage("postgres:17-alpine").Build();
        await postgres.StartAsync();
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["ConnectionStrings:UtilityMeter"] = postgres.GetConnectionString() }).Build();
        var services = new ServiceCollection();
        services.AddInfrastructure(configuration).AddApplication();
        services.AddSingleton<Serilog.ILogger>(Serilog.Log.Logger);
        await using var provider = services.BuildServiceProvider();
        async Task<T> Scope<T>(Func<IServiceProvider, Task<T>> run)
        { using var scope = provider.CreateScope(); return await run(scope.ServiceProvider); }
        async Task<T> Send<T>(IRequest<T> command) => await Scope(sp => sp.GetRequiredService<ISender>().Send(command));
        async Task<ReadingDto> Get(Guid id) => await Scope(async sp => (await sp.GetRequiredService<IReadingsRepository>().GetByIdAsync(id))!.ToWorkflowDto());
        using (var setup = provider.CreateScope())
            await setup.ServiceProvider.GetRequiredService<UtilityMeterDbContext>().Database.MigrateAsync();
        var property = await Send(new CreateProperty("Casa", "Santiago", ResourceType.Water, null, null));
        var meter = await Send(new CreateMeter(property.Id, "A1", ResourceType.Water, "m3", ""));
        var period = await Send(new CreateBillingPeriod(new DateTimeOffset(2026, 10, 1, 0, 0, 0, TimeSpan.Zero), new DateTimeOffset(2026, 11, 1, 0, 0, 0, TimeSpan.Zero)));
        CreateReadingCommand Command(decimal value, int day, Guid? key = null) => new(meter.Id, null, day == 30 ? null : period.Id, null, value, "m3",
            day == 30 ? new DateTimeOffset(2026, 9, 30, 0, 0, 0, TimeSpan.Zero) : new DateTimeOffset(2026, 10, day, 0, 0, 0, TimeSpan.Zero), "Company", key);
        var baseline = await Send(Command(100, 30));
        var last = await Send(Command(160, 3));
        var middle = await Send(Command(120, 1));
        (await Get(last.Id)).PreviousReadingId.ShouldBe(middle.Id);
        (await Get(last.Id)).Alerts.ShouldNotBeEmpty(); // 40 is more than 1.5 times the preceding 20.
        var current = await Get(middle.Id);
        var corrected = await Scope(sp => sp.GetRequiredService<IReadingWorkflow>().UpdateAsync(middle.Id,
            new(130, current.MeasuredAt, current.Version, "Fix transcription", period.Id), default));
        (await Get(last.Id)).Alerts.ShouldBeEmpty(); // Now 30 followed by 30.
        var summary = await Send(new GetMonthlySummaryQuery(period.Id));
        summary.CompanyTotal.ShouldBe(60);
        var history = await Scope(sp => sp.GetRequiredService<IReadingWorkflow>().HistoryAsync(last.Id, 1, 50, default));
        history.Items.Select(x => x.Action).ShouldContain("Recalculated");
        await Scope(sp => sp.GetRequiredService<IReadingWorkflow>().VoidAsync(middle.Id, new(corrected.Version, "Wrong document"), default));
        (await Get(last.Id)).PreviousReadingId.ShouldBe(baseline.Id);
        var key = Guid.NewGuid();
        var replays = await Task.WhenAll(Send(Command(170, 4, key)), Send(Command(170, 4, key)));
        replays[0].Id.ShouldBe(replays[1].Id);
        var count = await Scope(sp => sp.GetRequiredService<UtilityMeterDbContext>().Readings.CountAsync(x => x.Id == key));
        count.ShouldBe(1);
        var page = await Scope(sp => sp.GetRequiredService<CatalogDetails>().Meters(property.Id, null, "a1", 1, 1, default));
        page.Items.Single().Id.ShouldBe(meter.Id);
        page.TotalCount.ShouldBe(1);
        await Send(new SetBillingPeriodStatus(period.Id, BillingPeriodStatus.Closed));
        await Should.ThrowAsync<InvalidOperationException>(() => Send(Command(105, 30) with { MeasuredAt = new DateTimeOffset(2026, 9, 30, 12, 0, 0, TimeSpan.Zero) }));
        var unchanged = await Get(last.Id);
        unchanged.Value.ShouldBe(160);
        await Should.ThrowAsync<InvalidOperationException>(() => Scope(sp => sp.GetRequiredService<CatalogDetails>().Update(period.Id,
            new UpdateBillingPeriod(new DateTimeOffset(2026, 10, 1, 0, 0, 0, TimeSpan.Zero), new DateTimeOffset(2026, 12, 1, 0, 0, 0, TimeSpan.Zero)), default)));
    }
}

internal static class WorkflowMapping
{
    public static ReadingDto ToWorkflowDto(this Application.Readings.Entities.Reading r) => Application.Readings.Mappings.ReadingMappingExtensions.ToDto(r);
}
