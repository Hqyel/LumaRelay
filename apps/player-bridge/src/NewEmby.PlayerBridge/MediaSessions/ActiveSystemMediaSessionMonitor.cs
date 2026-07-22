using System.Runtime.InteropServices;

namespace NewEmby.PlayerBridge.MediaSessions;

internal sealed class ActiveSystemMediaSessionMonitor(
  ISmtcSessionManagerFactory managerFactory)
  : ISystemMediaSessionMonitor
{
  private readonly object sync = new();
  private ISmtcSessionManager? manager;
  private SmtcMonitorSnapshot snapshot = new(
    SmtcCapability.Unavailable,
    false,
    0,
    0);
  private IReadOnlyList<ISmtcSession> sessions = [];

  public event EventHandler<SmtcSessionEventArgs>? Changed;

  public SmtcMonitorSnapshot Snapshot
  {
    get
    {
      lock (sync)
        return snapshot;
    }
  }

  public async Task StartAsync(CancellationToken cancellationToken)
  {
    cancellationToken.ThrowIfCancellationRequested();
    ISmtcSessionManager? created = null;

    try
    {
      created = await managerFactory.CreateAsync(cancellationToken);
      cancellationToken.ThrowIfCancellationRequested();
      created.SessionsChanged += OnSessionsChanged;

      lock (sync)
        manager = created;

      created = null;
      RefreshSessions(SmtcSessionEventKind.SessionsChanged);
    }
    catch (OperationCanceledException)
    {
      created?.Dispose();
      throw;
    }
    catch (Exception exception) when (IsExpectedFailure(exception))
    {
      created?.Dispose();
      SetUnavailable();
    }
  }

  public Task StopAsync(CancellationToken cancellationToken)
  {
    ReleaseResources(Snapshot with
    {
      IsMonitoring = false,
      SessionCount = 0,
      PotPlayerSessionCount = 0,
    });

    return Task.CompletedTask;
  }

  private void OnSessionsChanged(object? sender, EventArgs args)
  {
    RefreshSessions(SmtcSessionEventKind.SessionsChanged);
  }

  private void OnMediaPropertiesChanged(object? sender, EventArgs args)
  {
    PublishSessionEvent(
      SmtcSessionEventKind.MediaPropertiesChanged,
      sender);
  }

  private void OnPlaybackInfoChanged(object? sender, EventArgs args)
  {
    PublishSessionEvent(
      SmtcSessionEventKind.PlaybackInfoChanged,
      sender);
  }

  private void OnTimelinePropertiesChanged(object? sender, EventArgs args)
  {
    PublishSessionEvent(
      SmtcSessionEventKind.TimelinePropertiesChanged,
      sender);
  }

  private void RefreshSessions(SmtcSessionEventKind kind)
  {
    ISmtcSessionManager? currentManager;
    lock (sync)
      currentManager = manager;

    if (currentManager is null)
      return;

    try
    {
      var currentSessions = currentManager.GetSessions();
      foreach (var session in currentSessions)
        Subscribe(session);

      IReadOnlyList<ISmtcSession> previous;
      lock (sync)
      {
        previous = sessions;
        sessions = currentSessions;
        snapshot = new SmtcMonitorSnapshot(
          SmtcCapability.Ready,
          true,
          currentSessions.Count,
          currentSessions.Count(IsPotPlayerSession));
      }

      foreach (var session in previous)
        DisposeSession(session);

      Publish(kind, null);
    }
    catch (Exception exception) when (IsExpectedFailure(exception))
    {
      SetUnavailable();
    }
  }

  private void Subscribe(ISmtcSession session)
  {
    session.MediaPropertiesChanged += OnMediaPropertiesChanged;
    session.PlaybackInfoChanged += OnPlaybackInfoChanged;
    session.TimelinePropertiesChanged += OnTimelinePropertiesChanged;
  }

  private void DisposeSession(ISmtcSession session)
  {
    session.MediaPropertiesChanged -= OnMediaPropertiesChanged;
    session.PlaybackInfoChanged -= OnPlaybackInfoChanged;
    session.TimelinePropertiesChanged -= OnTimelinePropertiesChanged;
    session.Dispose();
  }

  private void PublishSessionEvent(
    SmtcSessionEventKind kind,
    object? sender)
  {
    var session = sender as ISmtcSession;
    Publish(kind, session is null ? null : ReadSourceAppUserModelId(session));
  }

  private void Publish(SmtcSessionEventKind kind, string? sourceAppId)
  {
    Changed?.Invoke(
      this,
      new SmtcSessionEventArgs(kind, sourceAppId, Snapshot));
  }

  private void SetUnavailable()
  {
    ReleaseResources(new SmtcMonitorSnapshot(
      SmtcCapability.Unavailable,
      false,
      0,
      0));
  }

  private void ReleaseResources(SmtcMonitorSnapshot nextSnapshot)
  {
    ISmtcSessionManager? currentManager;
    IReadOnlyList<ISmtcSession> currentSessions;

    lock (sync)
    {
      currentManager = manager;
      currentSessions = sessions;
      manager = null;
      sessions = [];
      snapshot = nextSnapshot;
    }

    if (currentManager is not null)
    {
      currentManager.SessionsChanged -= OnSessionsChanged;
      currentManager.Dispose();
    }

    foreach (var session in currentSessions)
      DisposeSession(session);
  }

  private static bool IsPotPlayerSession(ISmtcSession session)
  {
    return ReadSourceAppUserModelId(session)
      .Contains("PotPlayer", StringComparison.OrdinalIgnoreCase);
  }

  private static string ReadSourceAppUserModelId(ISmtcSession session)
  {
    try
    {
      return session.SourceAppUserModelId ?? string.Empty;
    }
    catch (Exception exception) when (IsExpectedFailure(exception))
    {
      return string.Empty;
    }
  }

  private static bool IsExpectedFailure(Exception exception)
  {
    return exception is COMException
      or UnauthorizedAccessException
      or InvalidOperationException
      or IOException
      or NotSupportedException
      or PlatformNotSupportedException
      or TypeLoadException;
  }
}
