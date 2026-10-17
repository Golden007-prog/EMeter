namespace CleanMinimalApi.Presentation.Endpoints;

using Application.Extraction;
using Application.Evidence.Queries.GetEvidenceByReading;
using MediatR;

public static class ExtractionEndpoints
{
    public static WebApplication MapExtractionEndpoints(this WebApplication app)
    {
        app.MapGet("/api/reports/missing-readings/{billingPeriodId:guid}", async (Guid billingPeriodId, Guid? propertyId, ISender sender, CancellationToken ct) =>
            Results.Ok(await sender.Send(new Application.Reports.Queries.GetPendingReadings.GetMissingReadingsQuery(billingPeriodId, propertyId), ct)))
            .WithTags("reports").WithSummary("List up to 1000 known meters without a reading in this period")
            .Produces<List<Application.Reports.Queries.GetPendingReadings.MissingReadingDto>>();
        app.MapGet("/api/extractions/{id:guid}", async (Guid id, ISender sender, CancellationToken ct) =>
            Results.Ok(await sender.Send(new GetExtractionQuery(id), ct)))
            .WithTags("extractions").WithSummary("Get OCR status and proposed bill fields")
            .Produces<ExtractionStatus>().ProducesProblem(404);
        app.MapPost("/api/extractions/{id:guid}/confirm", async (Guid id, ConfirmExtractionCommand request, ISender sender, CancellationToken ct) =>
            Results.Ok(await sender.Send(request with { Id = id }, ct)))
            .WithTags("extractions").WithSummary("Confirm reviewed values and create a reading; repeat calls return the same reading")
            .Produces<CreateConfirmation>().ProducesValidationProblem().ProducesProblem(409);
        app.MapGet("/api/evidence/{id:guid}/download", async (Guid id, ISender sender, CancellationToken ct) =>
        {
            var result = await sender.Send(new DownloadEvidenceQuery(id), ct);
            return Results.File(result.Content, result.ContentType, result.FileName);
        }).WithTags("evidence").WithSummary("Download the original evidence").Produces(200).ProducesProblem(404);
        return app;
    }
}
