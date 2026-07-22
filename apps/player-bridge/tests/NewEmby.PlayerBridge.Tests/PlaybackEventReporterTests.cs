using NewEmby.PlayerBridge.MediaSessions;
using NewEmby.PlayerBridge.Playback;

namespace NewEmby.PlayerBridge.Tests;

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
    public List<PlayerPlaybackSnapshot> PlayingSnapshots { get; } = [];

    public List<PlayerPlaybackSnapshot> ProgressSnapshots { get; } = [];

    public List<RecordedProgressEvent> ProgressEvents { get; } = [];

    public Task SendPlayingAsync(
      PlayerPlaybackSnapshot snapshot,
      CancellationToken cancellationToken)
    {
      PlayingSnapshots.Add(snapshot);
      return Task.CompletedTask;
    }

    public Task SendProgressAsync(
      PlayerPlaybackSnapshot snapshot,
      string eventName,
      PlaybackTrackChange? trackChange,
      CancellationToken cancellationToken)
    {
      ProgressSnapshots.Add(snapshot);
      ProgressEvents.Add(new RecordedProgressEvent(eventName, trackChange));
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

    private static async Task WaitUntilAsync(Func<bool> condition)
    {
      using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(2));
      while (!condition())
        await Task.Delay(10, timeout.Token);
    }

    public sealed record RecordedProgressEvent(
      string Name,
      PlaybackTrackChange? TrackChange);
  }
}
