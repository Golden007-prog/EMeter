namespace CleanMinimalApi.Application.Catalog;

using Common.Enums;
using Common.Exceptions;
using FluentValidation;
using MediatR;
using Organizations.Entities;
using Condominiums.Entities;
using Properties.Entities;
using Meters.Entities;
using BillingPeriods.Entities;

public interface ICatalogRepository
{
    Task<ICatalogWriteLock> LockPeriodAsync(Guid id, CancellationToken cancellationToken);
    Task<T?> FindAsync<T>(Guid id, CancellationToken cancellationToken) where T : class;
    Task<List<T>> ListAsync<T>(CancellationToken cancellationToken) where T : class;
    Task<Common.Page<T>> PageAsync<T>(System.Linq.Expressions.Expression<Func<T, bool>> predicate, int page, int pageSize, CancellationToken cancellationToken) where T : class;
    void Add<T>(T entity) where T : class;
    Task SaveAsync(CancellationToken cancellationToken);
}
public interface ICatalogWriteLock : IAsyncDisposable
{
    Task CommitAsync(CancellationToken cancellationToken);
}

public sealed record CatalogItem(Guid Id, string Kind, string Name, Guid? ParentId = null, string? Unit = null,
    ResourceType? ResourceType = null, DateTimeOffset? Start = null, DateTimeOffset? End = null, string? Status = null);
public sealed record CreateOrganization(string Name, string? ContactEmail = null) : IRequest<CatalogItem>;
public sealed record CreateCondominium(string Name, string Address, Guid? OrganizationId = null) : IRequest<CatalogItem>;
public sealed record CreateProperty(string Name, string Address, ResourceType ResourceType, Guid? OrganizationId = null, Guid? CondominiumId = null) : IRequest<CatalogItem>;
public sealed record CreateMeter(Guid PropertyId, string SerialNumber, ResourceType ResourceType, string Unit, string Model = "") : IRequest<CatalogItem>;
public sealed record CreateBillingPeriod(DateTimeOffset Start, DateTimeOffset End) : IRequest<CatalogItem>;
public sealed record GetCatalog(string Kind) : IRequest<List<CatalogItem>>;
public sealed record SetMainMeter(Guid CondominiumId, Guid MeterId) : IRequest;
public sealed record SetBillingPeriodStatus(Guid Id, BillingPeriodStatus Status) : IRequest;

public sealed class CatalogHandler(ICatalogRepository repository) :
    IRequestHandler<CreateOrganization, CatalogItem>, IRequestHandler<CreateCondominium, CatalogItem>,
    IRequestHandler<CreateProperty, CatalogItem>, IRequestHandler<CreateMeter, CatalogItem>,
    IRequestHandler<CreateBillingPeriod, CatalogItem>, IRequestHandler<GetCatalog, List<CatalogItem>>,
    IRequestHandler<SetMainMeter>, IRequestHandler<SetBillingPeriodStatus>
{
    private async Task<T> Require<T>(Guid id, CancellationToken cancellationToken) where T : class =>
        await repository.FindAsync<T>(id, cancellationToken) ?? throw new NotFoundException(typeof(T).Name + " not found");
    private static void Text(string value, int max = 200)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Length > max)
            throw new ValidationException("Required text missing or too long");
    }
    public async Task<CatalogItem> Handle(CreateOrganization request, CancellationToken cancellationToken)
    {
        Text(request.Name);
        if (request.ContactEmail is { Length: > 250 } || (!string.IsNullOrWhiteSpace(request.ContactEmail) && !System.Net.Mail.MailAddress.TryCreate(request.ContactEmail, out _)))
            throw new ValidationException("Invalid contact email");
        var entity = new Organization { Name = request.Name, ContactEmail = request.ContactEmail };
        repository.Add(entity);
        await repository.SaveAsync(cancellationToken);
        return new(entity.Id, "organizations", entity.Name);
    }
    public async Task<CatalogItem> Handle(CreateCondominium request, CancellationToken cancellationToken)
    {
        Text(request.Name);
        Text(request.Address, 500);
        if (request.OrganizationId is { } org)
            await Require<Organization>(org, cancellationToken);
        var entity = new Condominium { Name = request.Name, Address = request.Address, OrganizationId = request.OrganizationId };
        repository.Add(entity);
        await repository.SaveAsync(cancellationToken);
        return new(entity.Id, "condominiums", entity.Name, entity.OrganizationId);
    }
    public async Task<CatalogItem> Handle(CreateProperty request, CancellationToken cancellationToken)
    {
        Text(request.Name);
        Text(request.Address, 500);
        if (!Enum.IsDefined(request.ResourceType))
            throw new ValidationException("Unknown resource type");
        var organizationId = request.OrganizationId;
        Condominium? condominium = null;
        if (request.CondominiumId is { } condoId)
        {
            condominium = await Require<Condominium>(condoId, cancellationToken);
            if (organizationId != null && condominium.OrganizationId != organizationId)
                throw new ValidationException("Organization differs from condominium");
            organizationId = condominium.OrganizationId;
        }
        var org = organizationId is { } orgId ? await Require<Organization>(orgId, cancellationToken) : null;
        var entity = new UtilityProperty
        {
            Name = request.Name,
            Address = request.Address,
            ResourceType = request.ResourceType,
            OrganizationId = organizationId,
            CondominiumId = request.CondominiumId
        };
        condominium?.PropertyIds.Add(entity.Id);
        org?.PropertyIds.Add(entity.Id);
        repository.Add(entity);
        await repository.SaveAsync(cancellationToken);
        return new(entity.Id, "properties", entity.Name, entity.CondominiumId ?? entity.OrganizationId, ResourceType: entity.ResourceType);
    }
    public async Task<CatalogItem> Handle(CreateMeter request, CancellationToken cancellationToken)
    {
        Text(request.SerialNumber, 100);
        Text(request.Unit, 50);
        if (request.Model is { Length: > 100 })
            throw new ValidationException("Meter model too long");
        if (!Enum.IsDefined(request.ResourceType))
            throw new ValidationException("Unknown resource type");
        var property = await Require<UtilityProperty>(request.PropertyId, cancellationToken);
        if (property.ResourceType != request.ResourceType)
            throw new ValidationException("Meter resource must match its property");
        var entity = new Meter
        {
            PropertyId = property.Id,
            SerialNumber = request.SerialNumber,
            ResourceType = request.ResourceType,
            Unit = request.Unit,
            Model = request.Model ?? ""
        };
        property.MeterIds.Add(entity.Id);
        repository.Add(entity);
        await repository.SaveAsync(cancellationToken);
        return new(entity.Id, "meters", entity.SerialNumber, entity.PropertyId, entity.Unit, entity.ResourceType);
    }
    public async Task<CatalogItem> Handle(CreateBillingPeriod request, CancellationToken cancellationToken)
    {
        if (request.Start == default || request.End <= request.Start)
            throw new ValidationException("Period end must follow start");
        var entity = new BillingPeriod { Start = request.Start.ToUniversalTime(), End = request.End.ToUniversalTime() };
        repository.Add(entity);
        await repository.SaveAsync(cancellationToken);
        return new(entity.Id, "billing-periods", "", Start: entity.Start, End: entity.End, Status: entity.Status.ToString());
    }
    public async Task<Unit> Handle(SetMainMeter request, CancellationToken cancellationToken)
    {
        var condominium = await Require<Condominium>(request.CondominiumId, cancellationToken);
        var meter = await Require<Meter>(request.MeterId, cancellationToken);
        var property = await Require<UtilityProperty>(meter.PropertyId, cancellationToken);
        if (property.CondominiumId != condominium.Id)
            throw new ValidationException("Main meter must belong to a property in this condominium");
        condominium.MainMeterId = meter.Id;
        await repository.SaveAsync(cancellationToken);
        return Unit.Value;
    }
    public async Task<Unit> Handle(SetBillingPeriodStatus request, CancellationToken cancellationToken)
    {
        await using var write = await repository.LockPeriodAsync(request.Id, cancellationToken);
        if (!Enum.IsDefined(request.Status))
            throw new ValidationException("Unknown status");
        var period = await Require<BillingPeriod>(request.Id, cancellationToken);
        period.SetStatus(request.Status);
        await repository.SaveAsync(cancellationToken);
        await write.CommitAsync(cancellationToken);
        return Unit.Value;
    }
    public async Task<List<CatalogItem>> Handle(GetCatalog request, CancellationToken cancellationToken) => request.Kind switch
    {
        "organizations" => (await repository.ListAsync<Organization>(cancellationToken)).Select(x => new CatalogItem(x.Id, request.Kind, x.Name)).ToList(),
        "condominiums" => (await repository.ListAsync<Condominium>(cancellationToken)).Select(x => new CatalogItem(x.Id, request.Kind, x.Name, x.OrganizationId)).ToList(),
        "properties" => (await repository.ListAsync<UtilityProperty>(cancellationToken)).Select(x => new CatalogItem(x.Id, request.Kind, x.Name, x.CondominiumId ?? x.OrganizationId, ResourceType: x.ResourceType)).ToList(),
        "meters" => (await repository.ListAsync<Meter>(cancellationToken)).Select(x => new CatalogItem(x.Id, request.Kind, x.SerialNumber, x.PropertyId, x.Unit, x.ResourceType)).ToList(),
        "billing-periods" => (await repository.ListAsync<BillingPeriod>(cancellationToken)).Select(x => new CatalogItem(x.Id, request.Kind, "", Start: x.Start, End: x.End, Status: x.Status.ToString())).ToList(),
        _ => throw new NotFoundException("Unknown catalog")
    };
}
