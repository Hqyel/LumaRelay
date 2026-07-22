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

    Assert.Single(client.Snapshots);
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
    Assert.Empty(client.Snapshots);

    monitor.Publish(CreateSnapshot(PlayerPlaybackState.Paused));
    await client.WaitForCountAsync(1);
    Assert.Equal(PlayerPlaybackState.Paused, client.Snapshots[0].State);
    await reporter.StopAsync(CancellationToken.None);
  }

  private static PlayerPlaybackSnapshot CreateSnapshot(
    PlayerPlaybackState state,
    bool isTimelineStale = false)
  {
    var now = DateTimeOffset.UtcNow;
    return new PlayerPlaybackSnapshot(
      Guid.Parse("11111111-1111-4111-8111-111111111111"),
      state,
      10_000_000,
      600_000_000,
      0,
      600_000_000,
      now,
      now,
      1,
      false,
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
    private readonly TaskCompletionSource changed = new(
      TaskCreationOptions.RunContinuationsAsynchronously);

    public List<PlayerPlaybackSnapshot> Snapshots { get; } = [];

    public Task SendPlayingAsync(
      PlayerPlaybackSnapshot snapshot,
      CancellationToken cancellationToken)
    {
      Snapshots.Add(snapshot);
      changed.TrySetResult();
      return Task.CompletedTask;
    }

    public async Task WaitForCountAsync(int count)
    {
      if (Snapshots.Count >= count)
        return;

      await changed.Task.WaitAsync(TimeSpan.FromSeconds(2));
    }
  }
}
