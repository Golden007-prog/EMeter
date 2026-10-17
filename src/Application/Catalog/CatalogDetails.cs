namespace CleanMinimalApi.Application.Catalog;

using Common;
using Common.Enums;
using Common.Exceptions;
using Organizations.Entities;
using Condominiums.Entities;
using Properties.Entities;
using Meters.Entities;
using BillingPeriods.Entities;
using FluentValidation;

public sealed record OrganizationDto(Guid Id, string Name, string? ContactEmail);
public sealed record CondominiumDto(Guid Id, string Name, string Address, Guid? OrganizationId, Guid? MainMeterId);
public sealed record PropertyDto(Guid Id, string Name, string Address, ResourceType ResourceType, Guid? OrganizationId, Guid? CondominiumId);
public sealed record MeterDto(Guid Id, Guid PropertyId, string SerialNumber, ResourceType ResourceType, string Unit, string Model, DateTimeOffset InstalledAt);
public sealed record BillingPeriodDto(Guid Id, DateTimeOffset Start, DateTimeOffset End, string Status);
public sealed record UpdateOrganization(string Name, string? ContactEmail);
public sealed record UpdateAddress(string Name, string Address);
public sealed record UpdateMeter(string SerialNumber, string Model);
public sealed record UpdateBillingPeriod(DateTimeOffset Start, DateTimeOffset End);

// Ownership/resource changes are intentionally excluded: existing reading history must keep its meaning.
public sealed class CatalogDetails(ICatalogRepository repository, Readings.IReadingsRepository readings)
{
    public async Task<T> Require<T>(Guid id, CancellationToken ct) where T : class =>
        await repository.FindAsync<T>(id, ct) ?? throw new NotFoundException(typeof(T).Name + " not found");
    public static OrganizationDto Map(Organization x) => new(x.Id, x.Name, x.ContactEmail);
    public static CondominiumDto Map(Condominium x) => new(x.Id, x.Name, x.Address, x.OrganizationId, x.MainMeterId);
    public static PropertyDto Map(UtilityProperty x) => new(x.Id, x.Name, x.Address, x.ResourceType, x.OrganizationId, x.CondominiumId);
    public static MeterDto Map(Meter x) => new(x.Id, x.PropertyId, x.SerialNumber, x.ResourceType, x.Unit, x.Model, x.InstalledAt);
    public static BillingPeriodDto Map(BillingPeriod x) => new(x.Id, x.Start, x.End, x.Status.ToString());
    private static Page<TResult> MapPage<T, TResult>(Page<T> page, Func<T, TResult> map) => new(page.Items.Select(map).ToList(), page.PageNumber, page.PageSize, page.TotalCount);
    // These expressions are translated to SQL lower()/LIKE by EF. StringComparison overloads
    // and culture arguments cannot be translated by the PostgreSQL provider.
#pragma warning disable CA1304, CA1311, CA1862
    public async Task<Page<OrganizationDto>> Organizations(string? search, int page, int size, CancellationToken ct) =>
        MapPage(await repository.PageAsync<Organization>(x => search == null || x.Name.ToLower().Contains(search.ToLower()), page, size, ct), Map);
    public async Task<Page<CondominiumDto>> Condominiums(Guid? organizationId, string? search, int page, int size, CancellationToken ct) =>
        MapPage(await repository.PageAsync<Condominium>(x => (!organizationId.HasValue || x.OrganizationId == organizationId) && (search == null || x.Name.ToLower().Contains(search.ToLower())), page, size, ct), Map);
    public async Task<Page<PropertyDto>> Properties(Guid? organizationId, Guid? condominiumId, string? search, int page, int size, CancellationToken ct) =>
        MapPage(await repository.PageAsync<UtilityProperty>(x => (!organizationId.HasValue || x.OrganizationId == organizationId) && (!condominiumId.HasValue || x.CondominiumId == condominiumId) && (search == null || x.Name.ToLower().Contains(search.ToLower())), page, size, ct), Map);
    public async Task<Page<MeterDto>> Meters(Guid? propertyId, ResourceType? resourceType, string? search, int page, int size, CancellationToken ct) =>
        MapPage(await repository.PageAsync<Meter>(x => (!propertyId.HasValue || x.PropertyId == propertyId) && (!resourceType.HasValue || x.ResourceType == resourceType) && (search == null || x.SerialNumber.ToLower().Contains(search.ToLower())), page, size, ct), Map);
#pragma warning restore CA1304, CA1311, CA1862
    public async Task<Page<BillingPeriodDto>> Periods(BillingPeriodStatus? status, int page, int size, CancellationToken ct) =>
        MapPage(await repository.PageAsync<BillingPeriod>(x => !status.HasValue || x.Status == status, page, size, ct), Map);

    private static string Text(string? value, int max)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > max)
            throw new ValidationException("Required text missing or too long");
        return value.Trim();
    }
    public async Task<OrganizationDto> Update(Guid id, UpdateOrganization request, CancellationToken ct)
    {
        var x = await Require<Organization>(id, ct);
        x.Name = Text(request.Name, 200);
        if (request.ContactEmail is { Length: > 250 })
            throw new ValidationException("Contact email too long");
        if (!string.IsNullOrWhiteSpace(request.ContactEmail) && !System.Net.Mail.MailAddress.TryCreate(request.ContactEmail, out _))
            throw new ValidationException("Invalid contact email");
        x.ContactEmail = request.ContactEmail;
        await repository.SaveAsync(ct);
        return Map(x);
    }
    public async Task<CondominiumDto> UpdateCondominium(Guid id, UpdateAddress request, CancellationToken ct)
    {
        var x = await Require<Condominium>(id, ct);
        x.Name = Text(request.Name, 200);
        x.Address = Text(request.Address, 500);
        await repository.SaveAsync(ct);
        return Map(x);
    }
    public async Task<PropertyDto> UpdateProperty(Guid id, UpdateAddress request, CancellationToken ct)
    {
        var x = await Require<UtilityProperty>(id, ct);
        x.Name = Text(request.Name, 200);
        x.Address = Text(request.Address, 500);
        await repository.SaveAsync(ct);
        return Map(x);
    }
    public async Task<MeterDto> Update(Guid id, UpdateMeter request, CancellationToken ct)
    {
        var x = await Require<Meter>(id, ct);
        x.SerialNumber = Text(request.SerialNumber, 100);
        if (request.Model == null || request.Model.Length > 100)
            throw new ValidationException("Invalid meter model");
        x.Model = request.Model;
        await repository.SaveAsync(ct);
        return Map(x);
    }
    public async Task<BillingPeriodDto> Update(Guid id, UpdateBillingPeriod request, CancellationToken ct)
    {
        await using var write = await repository.LockPeriodAsync(id, ct);
        var x = await Require<BillingPeriod>(id, ct);
        if (x.IsImmutable)
            throw new ConflictException("Closed billing periods are immutable");
        if (request.Start == default || request.End <= request.Start)
            throw new ValidationException("Period end must follow start");
        var existing = await readings.GetByBillingPeriodIdAsync(id, ct);
        if (existing.Any(r => r.MeasuredAt < request.Start || r.MeasuredAt > request.End))
            throw new ValidationException("New period dates exclude existing readings");
        x.Start = request.Start.ToUniversalTime();
        x.End = request.End.ToUniversalTime();
        await repository.SaveAsync(ct);
        await write.CommitAsync(ct);
        return Map(x);
    }
}
