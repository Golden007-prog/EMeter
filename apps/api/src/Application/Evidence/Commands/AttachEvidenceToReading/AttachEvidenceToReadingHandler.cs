namespace CleanMinimalApi.Application.Evidence.Commands.AttachEvidenceToReading;

using Readings;
using MediatR;

public sealed class AttachEvidenceToReadingHandler(IReadingWorkflow workflow)
    : IRequestHandler<AttachEvidenceToReadingCommand, AttachEvidenceToReadingResponse>
{
    public async Task<AttachEvidenceToReadingResponse> Handle(AttachEvidenceToReadingCommand request, CancellationToken cancellationToken)
    {
        await workflow.AttachAsync(request.ReadingId, request.EvidenceId, cancellationToken);
        return new(request.ReadingId, request.EvidenceId, "Evidence attached");
    }
}
