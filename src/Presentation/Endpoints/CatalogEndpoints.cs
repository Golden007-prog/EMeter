namespace CleanMinimalApi.Presentation.Endpoints;

using Application.Catalog;
using Application.Common.Enums;
using Application.Organizations.Entities;
using Application.Condominiums.Entities;
using Application.Properties.Entities;
using Application.Meters.Entities;
using Application.BillingPeriods.Entities;
using MediatR;

public static class CatalogEndpoints
{
    public static WebApplication MapCatalogEndpoints(this WebApplication app)
    {
        var root = app.MapGroup("/api").WithTags("catalog").ProducesValidationProblem().ProducesProblem(404).ProducesProblem(409).ProducesProblem(500);
        root.MapPost("/organizations", async (CreateOrganization request, ISender sender, CatalogDetails details, CancellationToken ct) =>
        {
            var created = await sender.Send(request, ct);
            return Results.Created($"/api/organizations/{created.Id}", CatalogDetails.Map(await details.Require<Organization>(created.Id, ct)));
        }).Produces<OrganizationDto>(201).ProducesValidationProblem().ProducesProblem(404);
        root.MapGet("/organizations/{id:guid}", async (Guid id, CatalogDetails details, CancellationToken ct) =>
            Results.Ok(CatalogDetails.Map(await details.Require<Organization>(id, ct))))
            .Produces<OrganizationDto>().ProducesProblem(404);
        root.MapPut("/organizations/{id:guid}", async (Guid id, UpdateOrganization request, CatalogDetails details, CancellationToken ct) =>
            Results.Ok(await details.Update(id, request, ct)))
            .Produces<OrganizationDto>().ProducesValidationProblem().ProducesProblem(404).ProducesProblem(409);
        root.MapPost("/condominiums", async (CreateCondominium request, ISender sender, CatalogDetails details, CancellationToken ct) =>
        {
            var created = await sender.Send(request, ct);
            return Results.Created($"/api/condominiums/{created.Id}", CatalogDetails.Map(await details.Require<Condominium>(created.Id, ct)));
        }).Produces<CondominiumDto>(201).ProducesValidationProblem().ProducesProblem(404);
        root.MapGet("/condominiums/{id:guid}", async (Guid id, CatalogDetails details, CancellationToken ct) =>
            Results.Ok(CatalogDetails.Map(await details.Require<Condominium>(id, ct))))
            .Produces<CondominiumDto>().ProducesProblem(404);
        root.MapPut("/condominiums/{id:guid}", async (Guid id, UpdateAddress request, CatalogDetails details, CancellationToken ct) =>
            Results.Ok(await details.UpdateCondominium(id, request, ct)))
            .Produces<CondominiumDto>().ProducesValidationProblem().ProducesProblem(404).ProducesProblem(409);
        root.MapPost("/properties", async (CreateProperty request, ISender sender, CatalogDetails details, CancellationToken ct) =>
        {
            var created = await sender.Send(request, ct);
            return Results.Created($"/api/properties/{created.Id}", CatalogDetails.Map(await details.Require<UtilityProperty>(created.Id, ct)));
        }).Produces<PropertyDto>(201).ProducesValidationProblem().ProducesProblem(404);
        root.MapGet("/properties/{id:guid}", async (Guid id, CatalogDetails details, CancellationToken ct) =>
            Results.Ok(CatalogDetails.Map(await details.Require<UtilityProperty>(id, ct))))
            .Produces<PropertyDto>().ProducesProblem(404);
        root.MapPut("/properties/{id:guid}", async (Guid id, UpdateAddress request, CatalogDetails details, CancellationToken ct) =>
            Results.Ok(await details.UpdateProperty(id, request, ct)))
            .Produces<PropertyDto>().ProducesValidationProblem().ProducesProblem(404).ProducesProblem(409);
        root.MapPost("/meters", async (CreateMeter request, ISender sender, CatalogDetails details, CancellationToken ct) =>
        {
            var created = await sender.Send(request, ct);
            return Results.Created($"/api/meters/{created.Id}", CatalogDetails.Map(await details.Require<Meter>(created.Id, ct)));
        }).Produces<MeterDto>(201).ProducesValidationProblem().ProducesProblem(404);
        root.MapGet("/meters/{id:guid}", async (Guid id, CatalogDetails details, CancellationToken ct) =>
            Results.Ok(CatalogDetails.Map(await details.Require<Meter>(id, ct))))
            .Produces<MeterDto>().ProducesProblem(404);
        root.MapPut("/meters/{id:guid}", async (Guid id, UpdateMeter request, CatalogDetails details, CancellationToken ct) =>
            Results.Ok(await details.Update(id, request, ct)))
            .Produces<MeterDto>().ProducesValidationProblem().ProducesProblem(404).ProducesProblem(409);
        root.MapPost("/billing-periods", async (CreateBillingPeriod request, ISender sender, CatalogDetails details, CancellationToken ct) =>
        {
            var created = await sender.Send(request, ct);
            return Results.Created($"/api/billing-periods/{created.Id}", CatalogDetails.Map(await details.Require<BillingPeriod>(created.Id, ct)));
        }).Produces<BillingPeriodDto>(201).ProducesValidationProblem().ProducesProblem(404);
        root.MapGet("/billing-periods/{id:guid}", async (Guid id, CatalogDetails details, CancellationToken ct) =>
            Results.Ok(CatalogDetails.Map(await details.Require<BillingPeriod>(id, ct))))
            .Produces<BillingPeriodDto>().ProducesProblem(404);
        root.MapPut("/billing-periods/{id:guid}", async (Guid id, UpdateBillingPeriod request, CatalogDetails details, CancellationToken ct) =>
            Results.Ok(await details.Update(id, request, ct)))
            .Produces<BillingPeriodDto>().ProducesValidationProblem().ProducesProblem(404).ProducesProblem(409);
        root.MapGet("/organizations", async (CatalogDetails details, CancellationToken ct, string? search = null, int page = 1, int pageSize = 50) =>
            await details.Organizations(search, page, pageSize, ct));
        root.MapGet("/condominiums", async (CatalogDetails details, CancellationToken ct, Guid? organizationId = null, string? search = null, int page = 1, int pageSize = 50) =>
            await details.Condominiums(organizationId, search, page, pageSize, ct));
        root.MapGet("/properties", async (CatalogDetails details, CancellationToken ct, Guid? organizationId = null, Guid? condominiumId = null, string? search = null, int page = 1, int pageSize = 50) =>
            await details.Properties(organizationId, condominiumId, search, page, pageSize, ct));
        root.MapGet("/meters", async (CatalogDetails details, CancellationToken ct, Guid? propertyId = null, ResourceType? resourceType = null, string? search = null, int page = 1, int pageSize = 50) =>
            await details.Meters(propertyId, resourceType, search, page, pageSize, ct));
        root.MapGet("/billing-periods", async (CatalogDetails details, CancellationToken ct, BillingPeriodStatus? status = null, int page = 1, int pageSize = 50) =>
            await details.Periods(status, page, pageSize, ct));
        root.MapPut("/condominiums/{id:guid}/main-meter/{meterId:guid}", async (Guid id, Guid meterId, ISender sender, CancellationToken ct) =>
        { await sender.Send(new SetMainMeter(id, meterId), ct); return Results.NoContent(); }).Produces(204).ProducesValidationProblem().ProducesProblem(404);
        root.MapPut("/billing-periods/{id:guid}/status/{status}", async (Guid id, BillingPeriodStatus status, ISender sender, CancellationToken ct) =>
        { await sender.Send(new SetBillingPeriodStatus(id, status), ct); return Results.NoContent(); }).Produces(204).ProducesValidationProblem().ProducesProblem(404).ProducesProblem(409);
        return app;
    }
}
