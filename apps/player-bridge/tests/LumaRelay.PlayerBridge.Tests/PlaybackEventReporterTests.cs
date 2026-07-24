using System.Collections.Concurrent;
using LumaRelay.PlayerBridge.MediaSessions;
using LumaRelay.PlayerBridge.Playback;

namespace LumaRelay.PlayerBridge.Tests;

public sealed class PlaybackEventReporterTests
{
  [Fact]
  public async Task SendsPlayingOnceForFreshMatchedSession()
  {
    var monitor = new FakePlaybackMonitor();
    var client = new RecordingPlaybackClient();
    using var reporter = new PlaybackEventReporter(monitor, client);
    await reporter.StartAsync(CancellationToken.None);

    monitor.Publish(CreateSnapshot(PlayerPlaybackState.Playing));
    await client.WaitForCountAsync(1);
    monitor.Publish(CreateSnapshot(PlayerPlaybackState.Playing));
    await Task.Delay(50);

    Assert.Single(client.PlayingSnapshots);
    await reporter.StopAsync(CancellationToken.None);
  }

  [Fact]
  public async Task IgnoresStaleTimelineUntilFreshObservationArrives()
  {
    var monitor = new FakePlaybackMonitor();
    var client = new RecordingPlaybackClient();
    using var reporter = new PlaybackEventReporter(monitor, client);
    await reporter.StartAsync(CancellationToken.None);

    monitor.Publish(CreateSnapshot(
      PlayerPlaybackState.Playing,
      isTimelineStale: true));
    await Task.Delay(50);
    Assert.Empty(client.PlayingSnapshots);

    monitor.Publish(CreateSnapshot(PlayerPlaybackState.Paused));
    await client.WaitForCountAsync(1);
    Assert.Equal(
      PlayerPlaybackState.Paused,
      client.PlayingSnapshots[0].State);
    await reporter.StopAsync(CancellationToken.None);
  }

  [Fact]
  public async Task SendsProgressHeartbeatsOnlyAfterPlayingSucceeded()
  {
    var monitor = new FakePlaybackMonitor();
    var client = new RecordingPlaybackClient();
    using var reporter = new PlaybackEventReporter(
      monitor,
      client,
      TimeSpan.FromMilliseconds(20));
    await reporter.StartAsync(CancellationToken.None);

    monitor.Publish(CreateSnapshot(PlayerPlaybackState.Playing));
    await client.WaitForCountAsync(1);
    await client.WaitForProgressCountAsync(2);

    Assert.True(client.ProgressSnapshots.Count >= 2);
    Assert.All(
      client.ProgressSnapshots,
      snapshot => Assert.False(snapshot.IsTimelineStale));
    await reporter.StopAsync(CancellationToken.None);
  }

  [Fact]
  public async Task StopsHeartbeatsWhenTimelineBecomesStale()
  {
    var monitor = new FakePlaybackMonitor();
    var client = new RecordingPlaybackClient();
    using var reporter = new PlaybackEventReporter(
      monitor,
      client,
      TimeSpan.FromMilliseconds(20));
    await reporter.StartAsync(CancellationToken.None);

    monitor.Publish(CreateSnapshot(PlayerPlaybackState.Playing));
    await client.WaitForProgressCountAsync(1);
    monitor.Publish(CreateSnapshot(
      PlayerPlaybackState.Playing,
      isTimelineStale: true));
    await Task.Delay(30);
    var countAfterStale = client.ProgressSnapshots.Count;
    await Task.Delay(60);

    Assert.Equal(countAfterStale, client.ProgressSnapshots.Count);
    await reporter.StopAsync(CancellationToken.None);
  }

  [Fact]
  public async Task SendsPauseUnpauseAndSeekImmediately()
  {
    var monitor = new FakePlaybackMonitor();
    var client = new RecordingPlaybackClient();
    using var reporter = new PlaybackEventReporter(
      monitor,
      client,
      TimeSpan.FromMinutes(1));
    await reporter.StartAsync(CancellationToken.None);

    monitor.Publish(CreateSnapshot(PlayerPlaybackState.Playing));
    await client.WaitForCountAsync(1);
    monitor.Publish(CreateSnapshot(PlayerPlaybackState.Paused));
    await client.WaitForEventAsync("pause");
    monitor.Publish(CreateSnapshot(PlayerPlaybackState.Playing));
    await client.WaitForEventAsync("unpause");
    monitor.Publish(CreateSnapshot(
      PlayerPlaybackState.Playing,
      hasSeeked: true,
      positionTicks: 90_000_000));
    await client.WaitForEventAsync("seek");

    Assert.Contains(client.ProgressEvents, item => item.Name == "pause");
    Assert.Contains(client.ProgressEvents, item => item.Name == "unpause");
    Assert.Contains(client.ProgressEvents, item => item.Name == "seek");
    await reporter.StopAsync(CancellationToken.None);
  }

  [Fact]
  public async Task ReportsExplicitAudioAndSubtitleTrackChanges()
  {
    var monitor = new FakePlaybackMonitor();
    var client = new RecordingPlaybackClient();
    using var reporter = new PlaybackEventReporter(
      monitor,
      client,
      TimeSpan.FromMinutes(1));
    await reporter.StartAsync(CancellationToken.None);
    monitor.Publish(CreateSnapshot(PlayerPlaybackState.Playing));
    await client.WaitForCountAsync(1);

    await reporter.ReportAudioTrackChangeAsync(
      CreateSnapshot(PlayerPlaybackState.Playing).PlaySessionId,
      2,
      CancellationToken.None);
    await reporter.ReportSubtitleTrackChangeAsync(
      CreateSnapshot(PlayerPlaybackState.Playing).PlaySessionId,
      null,
      CancellationToken.None);

    Assert.Contains(client.ProgressEvents, item =>
      item.Name == "audioTrackChange"
      && item.TrackChange == new PlaybackTrackChange("audio", 2));
    Assert.Contains(client.ProgressEvents, item =>
      item.Name == "subtitleTrackChange"
      && item.TrackChange == new PlaybackTrackChange("subtitle", null));
    await reporter.StopAsync(CancellationToken.None);
  }

  [Theory]
  [InlineData((int)PlayerPlaybackState.Ended, "ended")]
  [InlineData((int)PlayerPlaybackState.Stopped, "userExit")]
  [InlineData((int)PlayerPlaybackState.Closed, "userExit")]
  public async Task ReportsTerminalPlayerStatesOnce(
    int stateValue,
    string expectedReason)
  {
    var state = (PlayerPlaybackState)stateValue;
    var monitor = new FakePlaybackMonitor();
    var client = new RecordingPlaybackClient();
    using var reporter = new PlaybackEventReporter(
      monitor,
      client,
      TimeSpan.FromMinutes(1));
    await reporter.StartAsync(CancellationToken.None);
    monitor.Publish(CreateSnapshot(PlayerPlaybackState.Playing));
    await client.WaitForCountAsync(1);

    monitor.Publish(CreateSnapshot(state, positionTicks: 580_000_000));
    await client.WaitForStoppedCountAsync(1);
    monitor.Publish(CreateSnapshot(state, positionTicks: 580_000_000));
    await Task.Delay(30);

    var stopped = Assert.Single(client.StoppedEvents);
    Assert.Equal(expectedReason, stopped.Reason);
    Assert.Equal(580_000_000, stopped.Snapshot.PositionTicks);
    await reporter.StopAsync(CancellationToken.None);
  }

  [Fact]
  public async Task ReportsPlayerExitWhenMatchedSessionDisappears()
  {
    var monitor = new FakePlaybackMonitor();
    var client = new RecordingPlaybackClient();
    using var reporter = new PlaybackEventReporter(
      monitor,
      client,
      TimeSpan.FromMinutes(1));
    await reporter.StartAsync(CancellationToken.None);
    monitor.Publish(CreateSnapshot(PlayerPlaybackState.Playing));
    await client.WaitForCountAsync(1);

    monitor.PublishEmpty();
    await client.WaitForStoppedCountAsync(1);

    Assert.Equal("playerExit", client.StoppedEvents[0].Reason);
    await reporter.StopAsync(CancellationToken.None);
  }

  [Fact]
  public async Task ReportsBridgeExitDuringGracefulShutdown()
  {
    var monitor = new FakePlaybackMonitor();
    var client = new RecordingPlaybackClient();
    using var reporter = new PlaybackEventReporter(
      monitor,
      client,
      TimeSpan.FromMinutes(1));
    await reporter.StartAsync(CancellationToken.None);
    monitor.Publish(CreateSnapshot(PlayerPlaybackState.Playing));
    await client.WaitForCountAsync(1);

    await reporter.StopAsync(CancellationToken.None);

    Assert.Equal("bridgeExit", client.StoppedEvents[0].Reason);
  }

  private static PlayerPlaybackSnapshot CreateSnapshot(
    PlayerPlaybackState state,
    bool isTimelineStale = false,
    bool hasSeeked = false,
    long positionTicks = 10_000_000)
  {
    var now = DateTimeOffset.UtcNow;
    return new PlayerPlaybackSnapshot(
      Guid.Parse("11111111-1111-4111-8111-111111111111"),
      state,
      positionTicks,
      600_000_000,
      0,
      600_000_000,
      now,
      now,
      1,
      hasSeeked,
      isTimelineStale);
  }

  private sealed class FakePlaybackMonitor : IPotPlayerPlaybackMonitor
  {
    public event EventHandler? Changed;

    public PlayerPlaybackMonitorSnapshot Snapshot { get; private set; } =
      PlayerPlaybackMonitorSnapshot.Empty;

    public void Publish(PlayerPlaybackSnapshot snapshot)
    {
      Snapshot = new PlayerPlaybackMonitorSnapshot([snapshot]);
      Changed?.Invoke(this, EventArgs.Empty);
    }

    public void PublishEmpty()
    {
      Snapshot = PlayerPlaybackMonitorSnapshot.Empty;
      Changed?.Invoke(this, EventArgs.Empty);
    }

    public bool TryGetSnapshot(
      Guid playSessionId,
      out PlayerPlaybackSnapshot? snapshot)
    {
      snapshot = Snapshot.Sessions.FirstOrDefault(
        item => item.PlaySessionId == playSessionId);
      return snapshot is not null;
    }
  }

  private sealed class RecordingPlaybackClient : IPlaybackEventClient
  {
    private readonly ConcurrentQueue<PlayerPlaybackSnapshot>
      playingSnapshots = new();
    private readonly ConcurrentQueue<PlayerPlaybackSnapshot>
      progressSnapshots = new();
    private readonly ConcurrentQueue<RecordedProgressEvent>
      progressEvents = new();
    private readonly ConcurrentQueue<RecordedStoppedEvent>
      stoppedEvents = new();

    public IReadOnlyList<PlayerPlaybackSnapshot> PlayingSnapshots =>
      playingSnapshots.ToArray();

    public IReadOnlyList<PlayerPlaybackSnapshot> ProgressSnapshots =>
      progressSnapshots.ToArray();

    public IReadOnlyList<RecordedProgressEvent> ProgressEvents =>
      progressEvents.ToArray();

    public IReadOnlyList<RecordedStoppedEvent> StoppedEvents =>
      stoppedEvents.ToArray();

    public Task SendPlayingAsync(
      PlayerPlaybackSnapshot snapshot,
      CancellationToken cancellationToken)
    {
      playingSnapshots.Enqueue(snapshot);
      return Task.CompletedTask;
    }

    public Task SendProgressAsync(
      PlayerPlaybackSnapshot snapshot,
      string eventName,
      PlaybackTrackChange? trackChange,
      CancellationToken cancellationToken)
    {
      progressSnapshots.Enqueue(snapshot);
      progressEvents.Enqueue(new RecordedProgressEvent(
        eventName,
        trackChange));
      return Task.CompletedTask;
    }

    public Task SendStoppedAsync(
      PlayerPlaybackSnapshot snapshot,
      string reason,
      CancellationToken cancellationToken)
    {
      stoppedEvents.Enqueue(new RecordedStoppedEvent(snapshot, reason));
      return Task.CompletedTask;
    }

    public async Task WaitForCountAsync(int count)
    {
      await WaitUntilAsync(() => PlayingSnapshots.Count >= count);
    }

    public async Task WaitForProgressCountAsync(int count)
    {
      await WaitUntilAsync(() => ProgressSnapshots.Count >= count);
    }

    public async Task WaitForEventAsync(string eventName)
    {
      await WaitUntilAsync(() => ProgressEvents.Any(
        item => item.Name == eventName));
    }

    public async Task WaitForStoppedCountAsync(int count)
    {
      await WaitUntilAsync(() => StoppedEvents.Count >= count);
    }

    private static async Task WaitUntilAsync(Func<bool> condition)
    {
      using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(2));
      while (!condition())
        await Task.Delay(10, timeout.Token);
    }

    public sealed record RecordedProgressEvent(
      string Name,
      PlaybackTrackChange? TrackChange);

    public sealed record RecordedStoppedEvent(
      PlayerPlaybackSnapshot Snapshot,
      string Reason);
  }
}
