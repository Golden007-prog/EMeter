namespace CleanMinimalApi.Application.Evidence.Queries.GetEvidenceByReading;

using Common.Exceptions;
using MediatR;
using Storage;

public sealed record DownloadEvidenceQuery(Guid Id) : IRequest<EvidenceDownload>;
public sealed record EvidenceDownload(Stream Content, string FileName, string ContentType);
public sealed class DownloadEvidenceHandler(IEvidenceRepository repository, IObjectStorage storage)
    : IRequestHandler<DownloadEvidenceQuery, EvidenceDownload>
{
    public async Task<EvidenceDownload> Handle(DownloadEvidenceQuery request, CancellationToken cancellationToken)
    {
        var evidence = await repository.GetByIdAsync(request.Id, cancellationToken) ?? throw new NotFoundException("Evidence not found");
        return new(await storage.DownloadAsync(evidence.StorageKey, cancellationToken), evidence.FileName, evidence.ContentType);
    }
}
