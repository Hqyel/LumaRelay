#if WINDOWS
using Windows.Media.Control;

namespace NewEmby.PlayerBridge.MediaSessions;

internal sealed class WindowsSmtcSessionManagerFactory
  : ISmtcSessionManagerFactory
{
  public async Task<ISmtcSessionManager> CreateAsync(
    CancellationToken cancellationToken)
  {
    cancellationToken.ThrowIfCancellationRequested();
    var manager = await
      GlobalSystemMediaTransportControlsSessionManager.RequestAsync();
    cancellationToken.ThrowIfCancellationRequested();
    return new WindowsSmtcSessionManager(manager);
  }
}

internal sealed class WindowsSmtcSessionManager
  : ISmtcSessionManager
{
  private readonly GlobalSystemMediaTransportControlsSessionManager manager;
  private bool isDisposed;

  public WindowsSmtcSessionManager(
    GlobalSystemMediaTransportControlsSessionManager manager)
  {
    this.manager = manager;
    manager.SessionsChanged += OnSessionsChanged;
  }

  public event EventHandler? SessionsChanged;

  public IReadOnlyList<ISmtcSession> GetSessions()
  {
    ObjectDisposedException.ThrowIf(isDisposed, this);
    return manager
      .GetSessions()
      .Select(session => (ISmtcSession)new WindowsSmtcSession(session))
      .ToArray();
  }

  public void Dispose()
  {
    if (isDisposed)
      return;

    manager.SessionsChanged -= OnSessionsChanged;
    isDisposed = true;
  }

  private void OnSessionsChanged(
    GlobalSystemMediaTransportControlsSessionManager sender,
    SessionsChangedEventArgs args)
  {
    SessionsChanged?.Invoke(this, EventArgs.Empty);
  }
}

internal sealed class WindowsSmtcSession : ISmtcSession
{
  private readonly GlobalSystemMediaTransportControlsSession session;
  private bool isDisposed;

  public WindowsSmtcSession(
    GlobalSystemMediaTransportControlsSession session)
  {
    this.session = session;
    session.MediaPropertiesChanged += OnMediaPropertiesChanged;
    session.PlaybackInfoChanged += OnPlaybackInfoChanged;
    session.TimelinePropertiesChanged += OnTimelinePropertiesChanged;
  }

  public event EventHandler? MediaPropertiesChanged;
  public event EventHandler? PlaybackInfoChanged;
  public event EventHandler? TimelinePropertiesChanged;

  public string SourceAppUserModelId
  {
    get
    {
      ObjectDisposedException.ThrowIf(isDisposed, this);
      return session.SourceAppUserModelId ?? string.Empty;
    }
  }

  public async Task<SmtcMediaProperties?> GetMediaPropertiesAsync(
    CancellationToken cancellationToken)
  {
    ObjectDisposedException.ThrowIf(isDisposed, this);
    cancellationToken.ThrowIfCancellationRequested();
    var properties = await session.TryGetMediaPropertiesAsync();
    cancellationToken.ThrowIfCancellationRequested();
    if (properties is null)
      return null;

    return new SmtcMediaProperties(
      properties.Title ?? string.Empty,
      properties.Subtitle ?? string.Empty,
      properties.Artist ?? string.Empty,
      properties.AlbumTitle ?? string.Empty);
  }

  public SmtcPlaybackInfo GetPlaybackInfo()
  {
    ObjectDisposedException.ThrowIf(isDisposed, this);
    var playback = session.GetPlaybackInfo();
    var state = playback.PlaybackStatus switch
    {
      GlobalSystemMediaTransportControlsSessionPlaybackStatus.Closed =>
        SmtcPlaybackState.Closed,
      GlobalSystemMediaTransportControlsSessionPlaybackStatus.Opened =>
        SmtcPlaybackState.Opened,
      GlobalSystemMediaTransportControlsSessionPlaybackStatus.Changing =>
        SmtcPlaybackState.Changing,
      GlobalSystemMediaTransportControlsSessionPlaybackStatus.Stopped =>
        SmtcPlaybackState.Stopped,
      GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing =>
        SmtcPlaybackState.Playing,
      GlobalSystemMediaTransportControlsSessionPlaybackStatus.Paused =>
        SmtcPlaybackState.Paused,
      _ => SmtcPlaybackState.Unknown,
    };
    return new SmtcPlaybackInfo(state, playback.PlaybackRate ?? 0);
  }

  public SmtcTimelineProperties GetTimelineProperties()
  {
    ObjectDisposedException.ThrowIf(isDisposed, this);
    var timeline = session.GetTimelineProperties();
    return new SmtcTimelineProperties(
      timeline.StartTime.Ticks,
      timeline.EndTime.Ticks,
      timeline.Position.Ticks,
      timeline.MinSeekTime.Ticks,
      timeline.MaxSeekTime.Ticks,
      timeline.LastUpdatedTime);
  }

  public void Dispose()
  {
    if (isDisposed)
      return;

    session.MediaPropertiesChanged -= OnMediaPropertiesChanged;
    session.PlaybackInfoChanged -= OnPlaybackInfoChanged;
    session.TimelinePropertiesChanged -= OnTimelinePropertiesChanged;
    isDisposed = true;
  }

  private void OnMediaPropertiesChanged(
    GlobalSystemMediaTransportControlsSession sender,
    MediaPropertiesChangedEventArgs args)
  {
    MediaPropertiesChanged?.Invoke(this, EventArgs.Empty);
  }

  private void OnPlaybackInfoChanged(
    GlobalSystemMediaTransportControlsSession sender,
    PlaybackInfoChangedEventArgs args)
  {
    PlaybackInfoChanged?.Invoke(this, EventArgs.Empty);
  }

  private void OnTimelinePropertiesChanged(
    GlobalSystemMediaTransportControlsSession sender,
    TimelinePropertiesChangedEventArgs args)
  {
    TimelinePropertiesChanged?.Invoke(this, EventArgs.Empty);
  }
}
#endif
