namespace CleanMinimalApi.Application.Extraction;

using FluentValidation;
using MediatR;

public sealed record ExtractionStatus(Guid Id, Guid EvidenceId, string Status, int Attempts, string? Error,
    ExtractedBill? Result, Guid? ConfirmedReadingId);
public sealed record GetExtractionQuery(Guid Id) : IRequest<ExtractionStatus>;
public sealed class GetExtractionHandler(IExtractionJobs jobs) : IRequestHandler<GetExtractionQuery, ExtractionStatus>
{
    public async Task<ExtractionStatus> Handle(GetExtractionQuery request, CancellationToken cancellationToken)
    {
        var job = await jobs.GetAsync(request.Id, cancellationToken) ?? throw new Common.Exceptions.NotFoundException("Extraction not found");
        return new(job.Id, job.EvidenceId, job.Status, job.Attempts, job.Error,
            job.ResultJson == null ? null : System.Text.Json.JsonSerializer.Deserialize<ExtractedBill>(job.ResultJson), job.ConfirmedReadingId);
    }
}

public sealed record ConfirmExtractionCommand(Guid Id, Guid MeterId, Guid? PropertyId, Guid? BillingPeriodId,
    decimal Value, string Unit, DateTimeOffset MeasuredAt, string Source = "Company") : IRequest<CreateConfirmation>;
public sealed record ConfirmExtractionRequest(Guid MeterId, decimal Value, string Unit, DateTimeOffset MeasuredAt,
    Guid? PropertyId = null, Guid? BillingPeriodId = null, string Source = "Company");

public sealed class ConfirmExtractionValidator : AbstractValidator<ConfirmExtractionCommand>
{
    public ConfirmExtractionValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.MeterId).NotEmpty();
        RuleFor(x => x.Value).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Unit).NotEmpty().MaximumLength(50);
        RuleFor(x => x.MeasuredAt).NotEmpty();
        RuleFor(x => x.Source).Must(x => x is "Company" or "Resident" or "OCR");
    }
}

public sealed class ConfirmExtractionHandler(IExtractionJobs jobs) : IRequestHandler<ConfirmExtractionCommand, CreateConfirmation>
{
    public Task<CreateConfirmation> Handle(ConfirmExtractionCommand request, CancellationToken cancellationToken) =>
        jobs.ConfirmAsync(request.Id, request, cancellationToken);
}

public sealed record ProcessExtractionCommand(ExtractionJob Job) : IRequest;
public sealed class ProcessExtractionHandler(IExtractionJobs jobs, Evidence.IEvidenceRepository evidenceRepository,
    Storage.IObjectStorage storage, IMeterReadingExtractor extractor, Serilog.ILogger logger) : IRequestHandler<ProcessExtractionCommand>
{
    public async Task<Unit> Handle(ProcessExtractionCommand request, CancellationToken cancellationToken)
    {
        try
        {
            logger.Information("Processing extraction {ExtractionId}, attempt {Attempt}", request.Job.Id, request.Job.Attempts);
            var evidence = await evidenceRepository.GetByIdAsync(request.Job.EvidenceId, cancellationToken)
                ?? throw new InvalidOperationException("Evidence missing");
            using var stream = await storage.DownloadAsync(evidence.StorageKey, cancellationToken);
            var result = await extractor.ExtractAsync(stream, evidence.FileName, evidence.ContentType, cancellationToken);
            await jobs.CompleteAsync(request.Job, result, cancellationToken);
            logger.Information("Extraction {ExtractionId} ready for review", request.Job.Id);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
        catch (Exception ex)
        {
            logger.Error(ex, "Extraction {ExtractionId} failed", request.Job.Id);
            await jobs.FailAsync(request.Job, ex.Message, cancellationToken);
        }
        return Unit.Value;
    }
}
