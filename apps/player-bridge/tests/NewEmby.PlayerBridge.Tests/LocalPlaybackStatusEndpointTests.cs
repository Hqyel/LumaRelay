using NewEmby.PlayerBridge.MediaSessions;
using NewEmby.PlayerBridge.Playback;
using NewEmby.PlayerBridge.Players;

namespace NewEmby.PlayerBridge.Tests;

public sealed class LocalPlaybackStatusEndpointTests
{
  private static readonly Guid PlaySessionId = Guid.Parse(
    "22222222-2222-4222-8222-222222222222");
  private static readonly DateTimeOffset Now = new(
    2026,
    7,
    22,
    12,
    0,
    0,
    TimeSpan.Zero);

  [Fact]
  public void ReportsOnlyFreshTimelineAsSynchronized()
  {
    var status = LocalPlaybackStatusEndpoint.CreateStatus(
      Session(),
      new Matcher(PlayerSessionMatchState.Matched),
      new Monitor(Snapshot(
        PlayerPlaybackState.Playing,
        isTimelineStale: false)));

    Assert.Equal("playing", status.State);
    Assert.Equal("synchronized", status.SyncState);
    Assert.Equal(600_000_000, status.PositionTicks);
    Assert.Null(status.Warning);
  }

  [Fact]
  public void ExposesStaleTimelineWithoutClaimingSynchronization()
  {
    var status = LocalPlaybackStatusEndpoint.CreateStatus(
      Session(),
      new Matcher(PlayerSessionMatchState.Matched),
      new Monitor(Snapshot(
        PlayerPlaybackState.Paused,
        isTimelineStale: true)));

    Assert.Equal("paused", status.State);
    Assert.Equal("stale", status.SyncState);
    Assert.Equal("SMTC_STALE", status.Warning);
  }

  [Fact]
  public void ExposesAmbiguousMatchAsUnavailable()
  {
    var status = LocalPlaybackStatusEndpoint.CreateStatus(
      Session(),
      new Matcher(PlayerSessionMatchState.Ambiguous),
      new Monitor(null));

    Assert.Equal("unavailable", status.State);
    Assert.Equal("unavailable", status.SyncState);
    Assert.Equal("SMTC_AMBIGUOUS", status.Warning);
  }

  private static LocalPlaybackSession Session()
  {
    return new LocalPlaybackSession(
      PlaySessionId,
      new LocalPlaybackSelection(
        "item-1",
        "source-1",
        300_000_000,
        1,
        null),
      Now);
  }

  private static PlayerPlaybackSnapshot Snapshot(
    PlayerPlaybackState state,
    bool isTimelineStale)
  {
    return new PlayerPlaybackSnapshot(
      PlaySessionId,
      state,
      600_000_000,
      7_200_000_000,
      0,
      7_200_000_000,
      Now,
      Now,
      1,
      false,
      isTimelineStale);
  }

  private sealed class Matcher(PlayerSessionMatchState state)
    : IPotPlayerSessionMatcher
  {
    public event EventHandler? Changed
    {
      add { }
      remove { }
    }

    public PlayerSessionMatcherSnapshot Snapshot { get; } = new([
      new PlayerSessionMatch(
        PlaySessionId,
        123,
        Now,
        state,
        null,
        Now),
    ]);

    public void Track(PlayerLaunchResult launch)
    {
    }

    public bool TryGetMatchedSession(
      Guid playSessionId,
      out ISmtcSession? session)
    {
      session = null;
      return false;
    }

    public void Untrack(Guid playSessionId)
    {
    }
  }

  private sealed class Monitor(PlayerPlaybackSnapshot? playback)
    : IPotPlayerPlaybackMonitor
  {
    public event EventHandler? Changed
    {
      add { }
      remove { }
    }

    public PlayerPlaybackMonitorSnapshot Snapshot { get; } = playback is null
      ? PlayerPlaybackMonitorSnapshot.Empty
      : new PlayerPlaybackMonitorSnapshot([playback]);

    public bool TryGetSnapshot(
      Guid playSessionId,
      out PlayerPlaybackSnapshot? snapshot)
    {
      snapshot = playback;
      return playback is not null;
    }
  }
}
