namespace CleanMinimalApi.Application.BillingPeriods.Entities;

using CleanMinimalApi.Application.Common.Enums;
using CleanMinimalApi.Application.Common.Exceptions;

public class BillingPeriod
{
    public Guid Id { get; init; } = Guid.NewGuid();
    public DateTimeOffset Start { get; set; }
    public DateTimeOffset End { get; set; }
    public BillingPeriodStatus Status { get; set; } = BillingPeriodStatus.Open;
    public bool IsImmutable => this.Status == BillingPeriodStatus.Closed;

    public void SetStatus(BillingPeriodStatus status)
    {
        if (this.IsImmutable)
        {
            throw new ConflictException("Closed billing periods are immutable.");
        }

        this.Status = status;
    }
}
