using GridSign.BackgroundServices.Interfaces;

namespace GridSign.BackgroundServices;

public class BackgroundWorkerService(IBackgroundTaskQueue queue, IServiceProvider services) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var workItem = await queue.DequeueAsync(stoppingToken);
            try
            { 
                using var scope = services.CreateScope();
                await workItem(stoppingToken); 
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in background task: {ex.Message}");
            }
        }
    }
}