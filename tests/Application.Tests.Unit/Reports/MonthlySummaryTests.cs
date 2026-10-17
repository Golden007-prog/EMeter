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
    public async Task Summary_ShouldUseConsumptionAndKeepDifferentUnitsSeparate()
    {
        var period = Guid.NewGuid();
        var powerPrevious = new Reading { MeterId = Guid.NewGuid(), Value = 12000, Unit = "kWh", Source = "Company" };
        var waterPrevious = new Reading { MeterId = Guid.NewGuid(), Value = 1000, Unit = "m3", Source = "Company" };
        var powerMiddle = new Reading { MeterId = powerPrevious.MeterId, PreviousReadingId = powerPrevious.Id, Value = 12020, Unit = "kWh", Source = "Company", BillingPeriodId = period };
        var power = new Reading { MeterId = powerPrevious.MeterId, PreviousReadingId = powerMiddle.Id, Value = 12055, Unit = "kWh", Source = "Company", BillingPeriodId = period };
        var water = new Reading { MeterId = waterPrevious.MeterId, PreviousReadingId = waterPrevious.Id, Value = 1018, Unit = "m3", Source = "Company", BillingPeriodId = period };
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
