namespace CleanMinimalApi.Worker;

using Application.Extraction;
using MediatR;

public sealed class QueuedBackgroundWorker(IServiceScopeFactory scopes, ILogger<QueuedBackgroundWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopes.CreateScope();
                var job = await scope.ServiceProvider.GetRequiredService<IExtractionJobs>().ClaimAsync(stoppingToken);
                if (job == null) await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken);
                else await scope.ServiceProvider.GetRequiredService<ISender>().Send(new ProcessExtractionCommand(job), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                logger.LogError(ex, "Extraction worker iteration failed");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }
}
