namespace CleanMinimalApi.Application.Tests.Unit.Reports;

using Application.Readings;
using Application.Readings.Entities;
using Application.Reports.Queries.GetMonthlySummary;
using NSubstitute;
using Shouldly;
using Xunit;

public class MonthlySummaryTests
{
    [Fact]
    public async Task Summary_ShouldExposeUnknownConsumptionInsteadOfPartialTotals()
    {
        var period = Guid.NewGuid();
        var time = DateTimeOffset.UtcNow;
        var previous = new Reading { MeterId = Guid.NewGuid(), Unit = "m3", Source = "Company", Value = 100, MeasuredAt = time.AddDays(-1) };
        var known = new Reading { MeterId = previous.MeterId, PreviousReadingId = previous.Id, Unit = "m3", Source = "Company", Value = 120, MeasuredAt = time, BillingPeriodId = period };
        var missing = new Reading { MeterId = Guid.NewGuid(), Unit = "m3", Source = "Company", Value = 10000, MeasuredAt = time, BillingPeriodId = period };
        var manual = new Reading { MeterId = Guid.NewGuid(), Unit = "m3", Source = "Manual", Value = 50, MeasuredAt = time, BillingPeriodId = period };
        var repository = Substitute.For<IReadingsRepository>();
        repository.GetAllAsync(Arg.Any<CancellationToken>()).Returns([previous, known, missing, manual]);
        repository.GetByBillingPeriodIdAsync(period, Arg.Any<CancellationToken>()).Returns([known, missing, manual]);
        var summary = await new GetMonthlySummaryHandler(repository).Handle(new(period), default);
        summary.CompanyTotal.ShouldBeNull();
        summary.MismatchPercentage.ShouldBeNull();
        summary.UncalculableReadingCount.ShouldBe(2);
        summary.TotalsBySource!.Single(x => x.Source == "Company").Consumption.ShouldBeNull();
        summary.TotalsBySource!.Single(x => x.Source == "Manual").UncalculableReadingCount.ShouldBe(1);
    }

    [Fact]
    public async Task Summary_ShouldUseConsumptionAndKeepDifferentUnitsSeparate()
    {
        var period = Guid.NewGuid();
        var powerPrevious = new Reading { MeterId = Guid.NewGuid(), Value = 12000, Unit = "kWh", Source = "Company" };
        var waterPrevious = new Reading { MeterId = Guid.NewGuid(), Value = 1000, Unit = "m3", Source = "Company" };
        var powerMiddle = new Reading { MeterId = powerPrevious.MeterId, PreviousReadingId = powerPrevious.Id, Value = 12020, Unit = "kWh", Source = "Company", BillingPeriodId = period };
        var power = new Reading { MeterId = powerPrevious.MeterId, PreviousReadingId = powerMiddle.Id, Value = 12055, Unit = "kWh", Source = "Company", BillingPeriodId = period };
        var water = new Reading { MeterId = waterPrevious.MeterId, PreviousReadingId = waterPrevious.Id, Value = 1018, Unit = "m3", Source = "Company", BillingPeriodId = period };
        powerPrevious.MeasuredAt = waterPrevious.MeasuredAt = DateTimeOffset.UtcNow.AddDays(-2);
        powerMiddle.MeasuredAt = powerPrevious.MeasuredAt.AddDays(1);
        power.MeasuredAt = water.MeasuredAt = powerPrevious.MeasuredAt.AddDays(2);
        var repository = Substitute.For<IReadingsRepository>();
        repository.GetAllAsync(Arg.Any<CancellationToken>()).Returns([powerPrevious, waterPrevious, powerMiddle, power, water]);
        repository.GetByBillingPeriodIdAsync(period, Arg.Any<CancellationToken>()).Returns([powerMiddle, power, water]);
        var summary = await new GetMonthlySummaryHandler(repository).Handle(new(period), default);
        summary.CompanyTotal.ShouldBeNull();
        summary.TotalsByUnit.ShouldNotBeNull();
        summary.TotalsByUnit.Single(x => x.Unit == "kWh").Company.ShouldBe(55);
        summary.TotalsByUnit.Single(x => x.Unit == "m3").Company.ShouldBe(18);
    }
}
