namespace CleanMinimalApi.Application.Reports;

using CleanMinimalApi.Application.Condominiums.Entities;
using CleanMinimalApi.Application.Meters.Entities;
using CleanMinimalApi.Application.Properties.Entities;
using CleanMinimalApi.Application.Readings.Entities;

public sealed record CondominiumReconciliationData(
    Condominium Condominium,
    IReadOnlyList<UtilityProperty> Properties,
    IReadOnlyList<Meter> Meters,
    IReadOnlyList<Reading> Readings);

public interface ICondominiumReconciliationRepository
{
    Task<CondominiumReconciliationData?> GetAsync(Guid condominiumId, Guid billingPeriodId, CancellationToken cancellationToken = default);
}

public sealed record CondominiumPropertyIssue(
    Guid PropertyId,
    string PropertyName,
    decimal? Consumption,
    IReadOnlyList<string> Reasons);

public sealed record CondominiumReconciliationResult(
    Guid CondominiumId,
    Guid BillingPeriodId,
    decimal? MainConsumption,
    decimal SubMeterConsumption,
    decimal? Difference,
    decimal? DifferencePercentage,
    IReadOnlyList<CondominiumPropertyIssue> Suspects,
    string Explanation, string Source, string? Unit, bool IsComplete);

public static class CondominiumReconciliationCalculator
{
    public static CondominiumReconciliationResult Calculate(CondominiumReconciliationData data, Guid billingPeriodId, string source = "Resident")
    {
        ArgumentNullException.ThrowIfNull(data);
        if (source is not ("Resident" or "Company" or "Manual" or "OCR"))
            throw new FluentValidation.ValidationException("Unknown reading source");
        var main = data.Meters.SingleOrDefault(m => m.Id == data.Condominium.MainMeterId);
        var history = data.Readings.Where(Readings.ReadingTimeline.IsActive).ToDictionary(r => r.Id);
        decimal? ConsumptionFor(Meter meter, string origin)
        {
            var current = history.Values.Where(r => r.MeterId == meter.Id && r.BillingPeriodId == billingPeriodId && r.Source == origin)
                .OrderBy(r => r.MeasuredAt).ToList();
            if (current.Count == 0)
                return null;
            decimal total = 0;
            foreach (var r in current)
            {
                if (r.Unit != meter.Unit || r.PreviousReadingId == null || !history.TryGetValue(r.PreviousReadingId.Value, out var previous)
                    || previous.MeterId != r.MeterId || previous.Source != origin || previous.Unit != r.Unit || previous.MeasuredAt >= r.MeasuredAt || r.Value < previous.Value)
                    return null;
                total += r.Value - previous.Value;
            }
            return total;
        }
        var mainConsumption = main == null ? null : ConsumptionFor(main, source);
        var issues = new List<CondominiumPropertyIssue>();
        decimal subtotal = 0;
        bool complete = mainConsumption.HasValue;
        if (main != null)
            foreach (var property in data.Properties.Where(p => p.CondominiumId == data.Condominium.Id && p.ResourceType == main.ResourceType))
            {
                var meters = data.Meters.Where(m => m.PropertyId == property.Id && m.Id != main.Id && m.ResourceType == main.ResourceType).ToList();
                // A property used only to hold the main meter is not a missing sub-meter.
                if (meters.Count == 0 && main.PropertyId == property.Id)
                    continue;
                var reasons = new List<string>();
                decimal propertyTotal = 0;
                bool propertyComplete = meters.Count > 0;
                if (meters.Count == 0)
                    reasons.Add("Missing meter");
                foreach (var meter in meters)
                {
                    if (meter.Unit != main.Unit)
                    {
                        propertyComplete = false;
                        reasons.Add("Incompatible unit");
                        continue;
                    }
                    var consumption = ConsumptionFor(meter, source);
                    if (consumption.HasValue)
                    { propertyTotal += consumption.Value; subtotal += consumption.Value; }
                    else
                    {
                        propertyComplete = false;
                        reasons.Add(history.Values.Any(r => r.MeterId == meter.Id && r.Source == source && r.BillingPeriodId == billingPeriodId)
                            ? "Missing or invalid baseline" : "Missing reading");
                    }
                    var periodReadings = history.Values.Where(r => r.MeterId == meter.Id && r.BillingPeriodId == billingPeriodId).ToList();
                    if (periodReadings.Any(r => r.Source == source && r.Alerts.Any(a => a.Type == Alerts.AlertType.AbnormallyHighConsumption)))
                        reasons.Add("High consumption");
                    var resident = ConsumptionFor(meter, "Resident");
                    var company = ConsumptionFor(meter, "Company");
                    if (resident.HasValue && company.HasValue && resident.Value != company.Value)
                        reasons.Add("Bill mismatch");
                }
                complete &= propertyComplete;
                if (reasons.Count > 0)
                    issues.Add(new(property.Id, property.Name, propertyComplete ? propertyTotal : null, reasons.Distinct().ToList()));
            }
        decimal? difference = complete ? mainConsumption!.Value - subtotal : null;
        decimal? percentage = difference.HasValue && mainConsumption != 0 ? Math.Abs(difference.Value) / Math.Abs(mainConsumption!.Value) * 100 : null;
        var explanation = complete ? "Consumption reconciled using the selected source and compatible units."
            : "Reconciliation is incomplete: configure the main meter and supply valid readings and baselines in compatible units. Sub-meter consumption is a partial total.";
        return new(data.Condominium.Id, billingPeriodId, mainConsumption, subtotal, difference, percentage, issues, explanation, source, main?.Unit, complete);
    }
}
