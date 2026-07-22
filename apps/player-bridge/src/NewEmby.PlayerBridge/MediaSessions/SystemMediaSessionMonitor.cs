namespace NewEmby.PlayerBridge.MediaSessions;

internal enum SmtcCapability
{
  Ready,
  Unavailable,
  Unsupported,
}

internal enum SmtcSessionEventKind
{
  SessionsChanged,
  MediaPropertiesChanged,
  PlaybackInfoChanged,
  TimelinePropertiesChanged,
}

internal sealed record SmtcMonitorSnapshot(
  SmtcCapability Capability,
  bool IsMonitoring,
  int SessionCount,
  int PotPlayerSessionCount)
{
  public static SmtcMonitorSnapshot Unsupported { get; } = new(
    SmtcCapability.Unsupported,
    false,
    0,
    0);
}

internal sealed record SmtcMediaProperties(
  string Title,
  string Subtitle,
  string Artist,
  string AlbumTitle);

internal enum SmtcPlaybackState
{
  Unknown,
  Closed,
  Opened,
  Changing,
  Stopped,
  Playing,
  Paused,
}

internal sealed record SmtcPlaybackInfo(
  SmtcPlaybackState State,
  double PlaybackRate);

internal sealed record SmtcTimelineProperties(
  long StartTicks,
  long EndTicks,
  long PositionTicks,
  long MinSeekTicks,
  long MaxSeekTicks,
  DateTimeOffset LastUpdatedAt);

internal sealed class SmtcSessionEventArgs(
  SmtcSessionEventKind kind,
  string? sourceAppUserModelId,
  SmtcMonitorSnapshot snapshot) : EventArgs
{
  public SmtcSessionEventKind Kind { get; } = kind;
  public string? SourceAppUserModelId { get; } = sourceAppUserModelId;
  public SmtcMonitorSnapshot Snapshot { get; } = snapshot;
}

internal interface ISystemMediaSessionMonitor
{
  event EventHandler<SmtcSessionEventArgs>? Changed;

  SmtcMonitorSnapshot Snapshot { get; }
  IReadOnlyList<ISmtcSession> Sessions { get; }

  Task StartAsync(CancellationToken cancellationToken);
  Task StopAsync(CancellationToken cancellationToken);
}

internal interface ISmtcSession : IDisposable
{
  event EventHandler? MediaPropertiesChanged;
  event EventHandler? PlaybackInfoChanged;
  event EventHandler? TimelinePropertiesChanged;

  string SourceAppUserModelId { get; }

  Task<SmtcMediaProperties?> GetMediaPropertiesAsync(
    CancellationToken cancellationToken);

  SmtcPlaybackInfo GetPlaybackInfo();
  SmtcTimelineProperties GetTimelineProperties();
}

internal interface ISmtcSessionManager : IDisposable
{
  event EventHandler? SessionsChanged;

  IReadOnlyList<ISmtcSession> GetSessions();
}

internal interface ISmtcSessionManagerFactory
{
  Task<ISmtcSessionManager> CreateAsync(
    CancellationToken cancellationToken);
}

internal sealed class UnsupportedSystemMediaSessionMonitor
  : ISystemMediaSessionMonitor
{
  public event EventHandler<SmtcSessionEventArgs>? Changed
  {
    add { }
    remove { }
  }

  public SmtcMonitorSnapshot Snapshot => SmtcMonitorSnapshot.Unsupported;
  public IReadOnlyList<ISmtcSession> Sessions => [];

  public Task StartAsync(CancellationToken cancellationToken)
  {
    return Task.CompletedTask;
  }

  public Task StopAsync(CancellationToken cancellationToken)
  {
    return Task.CompletedTask;
  }
}

internal static class SystemMediaSessionMonitorFactory
{
  public static ISystemMediaSessionMonitor Create()
  {
#if WINDOWS
    if (OperatingSystem.IsWindowsVersionAtLeast(10, 0, 17763))
    {
      return new ActiveSystemMediaSessionMonitor(
        new WindowsSmtcSessionManagerFactory());
    }

    return new UnsupportedSystemMediaSessionMonitor();
#else
    return new UnsupportedSystemMediaSessionMonitor();
#endif
  }
}
