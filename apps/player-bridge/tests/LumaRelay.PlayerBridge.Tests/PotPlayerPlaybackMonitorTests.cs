using LumaRelay.PlayerBridge.MediaSessions;
using LumaRelay.PlayerBridge.Players;

namespace LumaRelay.PlayerBridge.Tests;

public sealed class PotPlayerPlaybackMonitorTests
{
  private static readonly Guid PlaySessionId = Guid.Parse(
    "44444444-4444-4444-8444-444444444444");
  private static readonly DateTimeOffset ObservedAt = new(
    2026,
    7,
    22,
    12,
    0,
    1,
    TimeSpan.Zero);

  [Fact]
  public async Task ReadsMatchedPlaybackAndRefreshesOnSessionEvents()
  {
    var session = new FakeSession();
    var matcher = new FakeMatcher(session);
    using var monitor = new PotPlayerPlaybackMonitor(
      matcher,
      new FixedTimeProvider(ObservedAt));
    await monitor.StartAsync(CancellationToken.None);
    await monitor.RefreshAsync(CancellationToken.None);

    var initial = Assert.Single(monitor.Snapshot.Sessions);
    Assert.Equal(PlayerPlaybackState.Playing, initial.State);
    Assert.Equal(TimeSpan.FromSeconds(10).Ticks, initial.PositionTicks);

    var paused = new TaskCompletionSource(
      TaskCreationOptions.RunContinuationsAsynchronously);
    monitor.Changed += (_, _) =>
    {
      if (monitor.Snapshot.Sessions.Any(item =>
        item.State == PlayerPlaybackState.Paused))
      {
        paused.TrySetResult();
      }
    };
    session.Playback = new SmtcPlaybackInfo(
      SmtcPlaybackState.Paused,
      1);
    session.RaisePlaybackInfoChanged();

    await paused.Task.WaitAsync(TimeSpan.FromSeconds(2));
    Assert.Equal(
      PlayerPlaybackState.Paused,
      Assert.Single(monitor.Snapshot.Sessions).State);
    await monitor.StopAsync(CancellationToken.None);
    Assert.Equal(0, session.PlaybackSubscriberCount);
    Assert.Equal(0, session.TimelineSubscriberCount);
  }

  [Fact]
  public async Task RemovesPlaybackWhenTheMatcherLosesItsSession()
  {
    var session = new FakeSession();
    var matcher = new FakeMatcher(session);
    using var monitor = new PotPlayerPlaybackMonitor(
      matcher,
      new FixedTimeProvider(ObservedAt));
    await monitor.StartAsync(CancellationToken.None);
    await monitor.RefreshAsync(CancellationToken.None);
    Assert.True(monitor.TryGetSnapshot(PlaySessionId, out _));

    matcher.RemoveMatch();
    await monitor.RefreshAsync(CancellationToken.None);

    Assert.Empty(monitor.Snapshot.Sessions);
    Assert.False(monitor.TryGetSnapshot(PlaySessionId, out _));
    Assert.Equal(0, session.PlaybackSubscriberCount);
    Assert.Equal(0, session.TimelineSubscriberCount);
    await monitor.StopAsync(CancellationToken.None);
  }

  [Fact]
  public async Task IsolatesAnUnreadableMatchedSession()
  {
    var session = new FakeSession { FailOnRead = true };
    var matcher = new FakeMatcher(session);
    using var monitor = new PotPlayerPlaybackMonitor(
      matcher,
      new FixedTimeProvider(ObservedAt));

    await monitor.RefreshAsync(CancellationToken.None);

    Assert.Empty(monitor.Snapshot.Sessions);
  }

  private sealed class FakeMatcher : IPotPlayerSessionMatcher
  {
    private readonly ISmtcSession session;

    public FakeMatcher(ISmtcSession session)
    {
      this.session = session;
      Snapshot = CreateSnapshot(session);
    }

    public event EventHandler? Changed;

    public PlayerSessionMatcherSnapshot Snapshot { get; private set; }

    public void Track(PlayerLaunchResult result)
    {
    }

    public void Untrack(Guid playSessionId)
    {
      RemoveMatch();
    }

    public bool TryGetMatchedSession(
      Guid playSessionId,
      out ISmtcSession? result)
    {
      result = Snapshot.Matches.Count == 0 ? null : session;
      return result is not null;
    }

    public void RemoveMatch()
    {
      Snapshot = PlayerSessionMatcherSnapshot.Empty;
      Changed?.Invoke(this, EventArgs.Empty);
    }

    private static PlayerSessionMatcherSnapshot CreateSnapshot(
      ISmtcSession session)
    {
      return new PlayerSessionMatcherSnapshot(
      [
        new PlayerSessionMatch(
          PlaySessionId,
          101,
          ObservedAt.AddSeconds(-1),
          PlayerSessionMatchState.Matched,
          session,
          ObservedAt),
      ]);
    }
  }

  private sealed class FakeSession : ISmtcSession
  {
    private EventHandler? playbackInfoChanged;
    private EventHandler? timelinePropertiesChanged;

    public event EventHandler? MediaPropertiesChanged
    {
      add { }
      remove { }
    }
    public event EventHandler? PlaybackInfoChanged
    {
      add { playbackInfoChanged += value; }
      remove { playbackInfoChanged -= value; }
    }
    public event EventHandler? TimelinePropertiesChanged
    {
      add { timelinePropertiesChanged += value; }
      remove { timelinePropertiesChanged -= value; }
    }

    public bool FailOnRead { get; init; }
    public int PlaybackSubscriberCount =>
      playbackInfoChanged?.GetInvocationList().Length ?? 0;
    public int TimelineSubscriberCount =>
      timelinePropertiesChanged?.GetInvocationList().Length ?? 0;
    public SmtcPlaybackInfo Playback { get; set; } = new(
      SmtcPlaybackState.Playing,
      1);
    public string SourceAppUserModelId => "PotPlayerMini64.exe";

    public Task<SmtcMediaProperties?> GetMediaPropertiesAsync(
      CancellationToken cancellationToken)
    {
      return Task.FromResult<SmtcMediaProperties?>(null);
    }

    public SmtcPlaybackInfo GetPlaybackInfo()
    {
      if (FailOnRead)
        throw new InvalidOperationException("expected test failure");

      return Playback;
    }

    public SmtcTimelineProperties GetTimelineProperties()
    {
      return new SmtcTimelineProperties(
        0,
        TimeSpan.FromMinutes(1).Ticks,
        TimeSpan.FromSeconds(10).Ticks,
        0,
        TimeSpan.FromMinutes(1).Ticks,
        ObservedAt);
    }

    public void RaisePlaybackInfoChanged()
    {
      playbackInfoChanged?.Invoke(this, EventArgs.Empty);
    }

    public void Dispose()
    {
    }
  }

  private sealed class FixedTimeProvider(DateTimeOffset value)
    : TimeProvider
  {
    public override DateTimeOffset GetUtcNow()
    {
      return value;
    }
  }
}
