using NewEmby.PlayerBridge.MediaSessions;

namespace NewEmby.PlayerBridge.Tests;

public sealed class ActiveSystemMediaSessionMonitorTests
{
  [Fact]
  public async Task MonitorsSessionsAndForwardsAllRequiredEvents()
  {
    var other = new FakeSession("browser.application");
    var potPlayer = new FakeSession("PotPlayerMini64.exe");
    var manager = new FakeSessionManager([other, potPlayer]);
    var monitor = new ActiveSystemMediaSessionMonitor(
      new FakeSessionManagerFactory(manager));
    var observed = new List<SmtcSessionEventArgs>();
    monitor.Changed += (_, args) => observed.Add(args);

    await monitor.StartAsync(CancellationToken.None);

    Assert.Equal(
      new SmtcMonitorSnapshot(SmtcCapability.Ready, true, 2, 1),
      monitor.Snapshot);
    Assert.Equal(
      SmtcSessionEventKind.SessionsChanged,
      Assert.Single(observed).Kind);

    potPlayer.RaiseMediaPropertiesChanged();
    potPlayer.RaisePlaybackInfoChanged();
    potPlayer.RaiseTimelinePropertiesChanged();

    Assert.Equal(
    [
      SmtcSessionEventKind.MediaPropertiesChanged,
      SmtcSessionEventKind.PlaybackInfoChanged,
      SmtcSessionEventKind.TimelinePropertiesChanged,
    ],
      observed.Skip(1).Select(item => item.Kind));
    Assert.All(
      observed.Skip(1),
      item => Assert.Equal(
        "PotPlayerMini64.exe",
        item.SourceAppUserModelId));

    await monitor.StopAsync(CancellationToken.None);

    Assert.False(monitor.Snapshot.IsMonitoring);
    Assert.Equal(0, monitor.Snapshot.SessionCount);
    Assert.True(manager.IsDisposed);
    Assert.True(other.IsDisposed);
    Assert.True(potPlayer.IsDisposed);
  }

  [Fact]
  public async Task RefreshesSubscriptionsWhenSessionListChanges()
  {
    var previous = new FakeSession("PotPlayerMini64.exe");
    var current = new FakeSession("other.application");
    var manager = new FakeSessionManager([previous]);
    var monitor = new ActiveSystemMediaSessionMonitor(
      new FakeSessionManagerFactory(manager));
    var observed = new List<SmtcSessionEventArgs>();
    monitor.Changed += (_, args) => observed.Add(args);
    await monitor.StartAsync(CancellationToken.None);

    manager.SetSessions([current]);
    manager.RaiseSessionsChanged();

    Assert.Equal(
      new SmtcMonitorSnapshot(SmtcCapability.Ready, true, 1, 0),
      monitor.Snapshot);
    Assert.True(previous.IsDisposed);
    Assert.False(current.IsDisposed);
    Assert.Equal(
      SmtcSessionEventKind.SessionsChanged,
      observed[^1].Kind);

    previous.RaisePlaybackInfoChanged();
    Assert.Equal(2, observed.Count);

    await monitor.StopAsync(CancellationToken.None);
    Assert.True(current.IsDisposed);
  }

  [Fact]
  public async Task ReportsUnavailableWhenManagerCannotBeCreated()
  {
    var monitor = new ActiveSystemMediaSessionMonitor(
      new FailingSessionManagerFactory());

    await monitor.StartAsync(CancellationToken.None);

    Assert.Equal(
      new SmtcMonitorSnapshot(SmtcCapability.Unavailable, false, 0, 0),
      monitor.Snapshot);
  }

  [Fact]
  public async Task ReleasesManagerWhenInitialSessionReadFails()
  {
    var manager = new FakeSessionManager([])
    {
      FailOnRead = true,
    };
    var monitor = new ActiveSystemMediaSessionMonitor(
      new FakeSessionManagerFactory(manager));

    await monitor.StartAsync(CancellationToken.None);

    Assert.Equal(SmtcCapability.Unavailable, monitor.Snapshot.Capability);
    Assert.False(monitor.Snapshot.IsMonitoring);
    Assert.True(manager.IsDisposed);
  }

  private sealed class FakeSessionManagerFactory(
    ISmtcSessionManager manager) : ISmtcSessionManagerFactory
  {
    public Task<ISmtcSessionManager> CreateAsync(
      CancellationToken cancellationToken)
    {
      return Task.FromResult(manager);
    }
  }

  private sealed class FailingSessionManagerFactory
    : ISmtcSessionManagerFactory
  {
    public Task<ISmtcSessionManager> CreateAsync(
      CancellationToken cancellationToken)
    {
      throw new UnauthorizedAccessException("expected test failure");
    }
  }

  private sealed class FakeSessionManager(
    IReadOnlyList<ISmtcSession> sessions) : ISmtcSessionManager
  {
    private IReadOnlyList<ISmtcSession> currentSessions = sessions;

    public event EventHandler? SessionsChanged;

    public bool IsDisposed { get; private set; }
    public bool FailOnRead { get; init; }

    public IReadOnlyList<ISmtcSession> GetSessions()
    {
      if (FailOnRead)
        throw new InvalidOperationException("expected test failure");

      return currentSessions;
    }

    public void SetSessions(IReadOnlyList<ISmtcSession> value)
    {
      currentSessions = value;
    }

    public void RaiseSessionsChanged()
    {
      SessionsChanged?.Invoke(this, EventArgs.Empty);
    }

    public void Dispose()
    {
      IsDisposed = true;
    }
  }

  private sealed class FakeSession(string sourceAppUserModelId) : ISmtcSession
  {
    public event EventHandler? MediaPropertiesChanged;
    public event EventHandler? PlaybackInfoChanged;
    public event EventHandler? TimelinePropertiesChanged;

    public bool IsDisposed { get; private set; }
    public string SourceAppUserModelId { get; } = sourceAppUserModelId;

    public void RaiseMediaPropertiesChanged()
    {
      MediaPropertiesChanged?.Invoke(this, EventArgs.Empty);
    }

    public void RaisePlaybackInfoChanged()
    {
      PlaybackInfoChanged?.Invoke(this, EventArgs.Empty);
    }

    public void RaiseTimelinePropertiesChanged()
    {
      TimelinePropertiesChanged?.Invoke(this, EventArgs.Empty);
    }

    public void Dispose()
    {
      IsDisposed = true;
    }
  }
}
