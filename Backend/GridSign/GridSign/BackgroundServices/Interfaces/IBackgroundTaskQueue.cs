namespace GridSign.BackgroundServices.Interfaces;

public interface IBackgroundTaskQueue
{
    void QueueBackgroundWorkItem(Func<CancellationToken, Task> workItem);
    public Task<Func<CancellationToken, Task>> DequeueAsync(CancellationToken cancellationToken);
}