namespace CleanMinimalApi.Presentation.Endpoints;

using Application.Extraction;
using Application.Evidence.Queries.GetEvidenceByReading;
using MediatR;

public static class ExtractionEndpoints
{
    public static WebApplication MapExtractionEndpoints(this WebApplication app)
    {
        var root = app.MapGroup("/api").ProducesValidationProblem().ProducesProblem(404).ProducesProblem(409).ProducesProblem(500);
        root.MapGet("/extractions", async (IExtractionJobs jobs, CancellationToken ct, string? status = null, int page = 1, int pageSize = 50) =>
            await jobs.ListAsync(status, page, pageSize, ct)).WithTags("extractions").ProducesValidationProblem();
        root.MapPost("/extractions/{id:guid}/retry", async (Guid id, IExtractionJobs jobs, CancellationToken ct) =>
            await jobs.RetryAsync(id, ct)).WithTags("extractions").Produces<ExtractionStatus>().ProducesProblem(404).ProducesProblem(409);
        root.MapGet("/reports/missing-readings/{billingPeriodId:guid}", async (Guid billingPeriodId, Guid? propertyId, ISender sender, CancellationToken ct) =>
            Results.Ok(await sender.Send(new Application.Reports.Queries.GetPendingReadings.GetMissingReadingsQuery(billingPeriodId, propertyId), ct)))
            .WithTags("reports").WithSummary("List known meters without a reading in this period")
            .Produces<List<Application.Reports.Queries.GetPendingReadings.MissingReadingDto>>();
        root.MapGet("/extractions/{id:guid}", async (Guid id, ISender sender, CancellationToken ct) =>
            Results.Ok(await sender.Send(new GetExtractionQuery(id), ct)))
            .WithTags("extractions").WithSummary("Get OCR status and proposed bill fields")
            .Produces<ExtractionStatus>().ProducesProblem(404);
        root.MapPost("/extractions/{id:guid}/confirm", async (Guid id, ConfirmExtractionRequest request, ISender sender, CancellationToken ct) =>
            Results.Ok(await sender.Send(new ConfirmExtractionCommand(id, request.MeterId, request.PropertyId, request.BillingPeriodId, request.Value, request.Unit, request.MeasuredAt, request.Source), ct)))
            .WithTags("extractions").WithSummary("Confirm reviewed values and create a reading; repeat calls return the same reading")
            .Produces<CreateConfirmation>().ProducesValidationProblem().ProducesProblem(409);
        root.MapGet("/evidence/{id:guid}/download", async (Guid id, ISender sender, CancellationToken ct) =>
        {
            var result = await sender.Send(new DownloadEvidenceQuery(id), ct);
            return Results.File(result.Content, result.ContentType, result.FileName);
        }).WithTags("evidence").WithSummary("Download the original evidence").Produces(200).ProducesProblem(404);
        return app;
    }
}
