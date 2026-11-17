namespace CleanMinimalApi.Application.Readings.Commands.CreateReading;

using MediatR;

public sealed class CreateReadingHandler(IReadingWorkflow workflow) : IRequestHandler<CreateReadingCommand, CreateReadingResponse>
{
    public Task<CreateReadingResponse> Handle(CreateReadingCommand request, CancellationToken cancellationToken) => workflow.CreateAsync(request, cancellationToken);
}
