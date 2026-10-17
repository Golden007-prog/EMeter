namespace CleanMinimalApi.Application.Tests.Unit.Reports;

using Application.Common.Enums;
using Application.Condominiums.Entities;
using Application.Meters.Entities;
using Application.Properties.Entities;
using Application.Reports;
using Application.Readings.Entities;
using Shouldly;
using Xunit;

public class CondominiumReconciliationTests
{
    private readonly Guid period = Guid.NewGuid();
    private readonly Condominium condominium = new();
    private readonly List<UtilityProperty> properties = [];
    private readonly List<Meter> meters = [];
    private readonly List<Reading> readings = [];
    private Meter Meter(bool main = false, string unit = "m3", UtilityProperty? property = null)
    {
        if (property == null)
        {
            property = new() { Name = "House", CondominiumId = condominium.Id, ResourceType = ResourceType.Water };
            properties.Add(property);
        }
        var meter = new Meter { PropertyId = property.Id, ResourceType = ResourceType.Water, Unit = unit };
        meters.Add(meter);
        property.MeterIds.Add(meter.Id);
        if (main)
            condominium.MainMeterId = meter.Id;
        return meter;
    }
    private Reading Pair(Meter meter, decimal previous, decimal current, string source = "Resident")
    {
        var baseline = new Reading
        {
            MeterId = meter.Id,
            PropertyId = meter.PropertyId,
            Unit = meter.Unit,
            Source = source,
            Value = previous,
            MeasuredAt = new DateTimeOffset(2026, 9, 30, 0, 0, 0, TimeSpan.Zero)
        };
        var reading = new Reading
        {
            MeterId = meter.Id,
            PropertyId = meter.PropertyId,
            Unit = meter.Unit,
            Source = source,
            Value = current,
            BillingPeriodId = period,
            PreviousReadingId = baseline.Id,
            MeasuredAt = baseline.MeasuredAt.AddDays(1)
        };
        readings.AddRange([baseline, reading]);
        return reading;
    }
    private CondominiumReconciliationResult Calculate(string source = "Resident") =>
        CondominiumReconciliationCalculator.Calculate(new(condominium, properties, meters, readings), period, source);

    [Fact]
    public void ExcludesMainAndSumsEverySubMeterIncludingThoseOnTheSameProperty()
    {
        var main = Meter(main: true);
        Pair(main, 1000, 1100);
        Pair(Meter(property: properties[0]), 200, 220);
        var first = Meter();
        Pair(first, 500, 550);
        Pair(Meter(property: properties[1]), 30, 60);
        var result = Calculate();
        result.IsComplete.ShouldBeTrue();
        result.MainConsumption.ShouldBe(100);
        result.SubMeterConsumption.ShouldBe(100);
        result.Difference.ShouldBe(0);
        result.Suspects.ShouldBeEmpty();
    }
    [Fact]
    public void NeverTreatsAnAccumulatedReadingAsConsumption()
    {
        Pair(Meter(true), 100, 150);
        var sub = Meter();
        readings.Add(new Reading { MeterId = sub.Id, PropertyId = sub.PropertyId, BillingPeriodId = period, Value = 10000, Unit = "m3", Source = "Resident" });
        var result = Calculate();
        result.IsComplete.ShouldBeFalse();
        result.Difference.ShouldBeNull();
        result.SubMeterConsumption.ShouldBe(0);
        result.Suspects.Single().Reasons.ShouldContain("Missing or invalid baseline");
    }
    [Fact]
    public void FlagsMissingReadingsAndIncompatibleUnitsWithoutAddingThem()
    {
        Pair(Meter(true), 100, 200);
        Meter();
        Pair(Meter(unit: "L"), 1000, 4000);
        var result = Calculate();
        result.IsComplete.ShouldBeFalse();
        result.DifferencePercentage.ShouldBeNull();
        result.SubMeterConsumption.ShouldBe(0);
        result.Suspects.SelectMany(x => x.Reasons).ShouldContain("Missing reading");
        result.Suspects.SelectMany(x => x.Reasons).ShouldContain("Incompatible unit");
    }
    [Fact]
    public void KeepsSourcesSeparateAndComparesConsumptionInsteadOfAccumulatedValues()
    {
        Pair(Meter(true), 100, 150);
        var sub = Meter();
        Pair(sub, 1000, 1040);
        Pair(sub, 5000, 5050, "Company");
        var result = Calculate();
        result.SubMeterConsumption.ShouldBe(40);
        result.Difference.ShouldBe(10);
        result.Suspects.Single().Reasons.ShouldContain("Bill mismatch");
        Pair(meters[0], 10000, 10050, "Company");
        Calculate("Company").Difference.ShouldBe(0);
    }
    [Fact]
    public void SumsAllPeriodIncrementsAndIgnoresVoidedReadings()
    {
        Pair(Meter(true), 100, 150);
        var sub = Meter();
        var first = Pair(sub, 10, 30);
        readings.Add(new Reading
        {
            MeterId = sub.Id,
            PropertyId = sub.PropertyId,
            BillingPeriodId = period,
            Source = "Resident",
            Unit = "m3",
            Value = 60,
            PreviousReadingId = first.Id,
            MeasuredAt = first.MeasuredAt.AddDays(1)
        });
        var inactive = Pair(sub, 0, 9999, "Company");
        inactive.ReviewStatus = "Voided";
        Calculate().Difference.ShouldBe(0);
    }
    [Fact]
    public void RejectsDecreasedValuesAndMissingMainMeterAsIncomplete()
    {
        Pair(Meter(true), 100, 90);
        Pair(Meter(), 10, 20);
        Calculate().MainConsumption.ShouldBeNull();
        Calculate().IsComplete.ShouldBeFalse();
        condominium.MainMeterId = null;
        Calculate().Difference.ShouldBeNull();
    }
}
