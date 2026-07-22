using Microsoft.Extensions.Hosting;

namespace NewEmby.PlayerBridge.MediaSessions;

internal sealed class SmtcMonitorHostedService(
  ISystemMediaSessionMonitor monitor) : IHostedService
{
  public Task StartAsync(CancellationToken cancellationToken)
  {
    return monitor.StartAsync(cancellationToken);
  }

  public Task StopAsync(CancellationToken cancellationToken)
  {
    return monitor.StopAsync(cancellationToken);
  }
}
