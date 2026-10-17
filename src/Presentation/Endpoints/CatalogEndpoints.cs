namespace CleanMinimalApi.Presentation.Endpoints;
using Application.Catalog;
using Application.Common.Enums;
using MediatR;
public static class CatalogEndpoints
{
    public static WebApplication MapCatalogEndpoints(this WebApplication app)
    {
        app.MapPost("/api/organizations", async (CreateOrganization request, ISender sender, CancellationToken ct) =>
            Results.Ok(await sender.Send(request, ct))).WithTags("catalog").WithSummary("Create organizations").Produces<CatalogItem>().ProducesValidationProblem();
        app.MapGet("/api/organizations", async (ISender sender, CancellationToken ct) =>
            Results.Ok(await sender.Send(new GetCatalog("organizations"), ct))).WithTags("catalog").WithSummary("List up to 1000 organizations").Produces<List<CatalogItem>>();
        app.MapPost("/api/condominiums", async (CreateCondominium request, ISender sender, CancellationToken ct) =>
            Results.Ok(await sender.Send(request, ct))).WithTags("catalog").WithSummary("Create condominiums").Produces<CatalogItem>().ProducesValidationProblem();
        app.MapGet("/api/condominiums", async (ISender sender, CancellationToken ct) =>
            Results.Ok(await sender.Send(new GetCatalog("condominiums"), ct))).WithTags("catalog").WithSummary("List up to 1000 condominiums").Produces<List<CatalogItem>>();
        app.MapPost("/api/properties", async (CreateProperty request, ISender sender, CancellationToken ct) =>
            Results.Ok(await sender.Send(request, ct))).WithTags("catalog").WithSummary("Create properties").Produces<CatalogItem>().ProducesValidationProblem();
        app.MapGet("/api/properties", async (ISender sender, CancellationToken ct) =>
            Results.Ok(await sender.Send(new GetCatalog("properties"), ct))).WithTags("catalog").WithSummary("List up to 1000 properties").Produces<List<CatalogItem>>();
        app.MapPost("/api/meters", async (CreateMeter request, ISender sender, CancellationToken ct) =>
            Results.Ok(await sender.Send(request, ct))).WithTags("catalog").WithSummary("Create meters").Produces<CatalogItem>().ProducesValidationProblem();
        app.MapGet("/api/meters", async (ISender sender, CancellationToken ct) =>
            Results.Ok(await sender.Send(new GetCatalog("meters"), ct))).WithTags("catalog").WithSummary("List up to 1000 meters").Produces<List<CatalogItem>>();
        app.MapPost("/api/billing-periods", async (CreateBillingPeriod request, ISender sender, CancellationToken ct) =>
            Results.Ok(await sender.Send(request, ct))).WithTags("catalog").WithSummary("Create billing-periods").Produces<CatalogItem>().ProducesValidationProblem();
        app.MapGet("/api/billing-periods", async (ISender sender, CancellationToken ct) =>
            Results.Ok(await sender.Send(new GetCatalog("billing-periods"), ct))).WithTags("catalog").WithSummary("List up to 1000 billing-periods").Produces<List<CatalogItem>>();
        app.MapPut("/api/condominiums/{id:guid}/main-meter/{meterId:guid}", async (Guid id, Guid meterId, ISender sender, CancellationToken ct) =>
        { await sender.Send(new SetMainMeter(id, meterId), ct); return Results.NoContent(); }).WithTags("catalog").WithSummary("Set condominium main meter").Produces(204);
        app.MapPut("/api/billing-periods/{id:guid}/status/{status}", async (Guid id, BillingPeriodStatus status, ISender sender, CancellationToken ct) =>
        { await sender.Send(new SetBillingPeriodStatus(id, status), ct); return Results.NoContent(); }).WithTags("catalog").WithSummary("Set period status; closed periods are immutable").Produces(204);
        return app;
    }
}
