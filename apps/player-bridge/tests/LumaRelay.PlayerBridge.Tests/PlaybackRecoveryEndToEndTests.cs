using System.Collections.Concurrent;
using System.Net;
using System.Text.Json;
using LumaRelay.PlayerBridge.MediaSessions;
using LumaRelay.PlayerBridge.Pairing;
using LumaRelay.PlayerBridge.Playback;
using LumaRelay.PlayerBridge.Security;

namespace LumaRelay.PlayerBridge.Tests;

public sealed class PlaybackRecoveryEndToEndTests
{
  private static readonly Guid PlaySessionId = Guid.Parse(
    "22222222-2222-4222-8222-222222222222");

  [Fact]
  public async Task ReportsPauseSeekEndAndRetriesDisconnectionInOrder()
  {
    var handler = new PlaybackGatewayHandler(failFirstPause: true);
    using var httpClient = new HttpClient(handler);
    var monitor = new ControlledPlaybackMonitor();
    var eventClient = new GatewayPlaybackEventClient(
      httpClient,
      new StoredCredentialStore(),
      TimeSpan.FromMilliseconds(5));
    using var reporter = new PlaybackEventReporter(
      monitor,
      eventClient,
      TimeSpan.FromMinutes(1));
    await reporter.StartAsync(CancellationToken.None);

    monitor.Publish(Snapshot(PlayerPlaybackState.Playing, 10_000_000));
    await handler.WaitForAsync(item => item.EventType == "playing");
    monitor.Publish(Snapshot(PlayerPlaybackState.Paused, 20_000_000));
    await handler.WaitForCountAsync(
      item => item.EventName == "pause",
      2);
    monitor.Publish(Snapshot(PlayerPlaybackState.Playing, 20_000_000));
    await handler.WaitForAsync(item => item.EventName == "unpause");
    monitor.Publish(Snapshot(
      PlayerPlaybackState.Playing,
      300_000_000,
      hasSeeked: true));
    await handler.WaitForAsync(item => item.EventName == "seek");
    monitor.Publish(Snapshot(PlayerPlaybackState.Ended, 590_000_000));
    await handler.WaitForAsync(item => item.EventType == "stopped");

    var requests = handler.Requests;
    var pauses = requests.Where(item => item.EventName == "pause").ToArray();
    Assert.Equal(2, pauses.Length);
    Assert.Equal(pauses[0].Sequence, pauses[1].Sequence);
    Assert.Equal(pauses[0].Payload, pauses[1].Payload);
    Assert.NotEqual(pauses[0].Nonce, pauses[1].Nonce);
    Assert.Contains(requests, item =>
      item.EventName == "seek"
      && item.PositionTicks == 300_000_000);
    Assert.Contains(requests, item =>
      item.EventType == "stopped"
      && item.Reason == "ended"
      && item.PositionTicks == 590_000_000);
    Assert.Equal(
      [1L, 2L, 2L, 3L, 4L, 5L],
      requests.Select(item => item.Sequence).ToArray());
    await reporter.StopAsync(CancellationToken.None);
  }

  [Fact]
  public async Task ReportsPlayerCrashAfterAnEstablishedSessionDisappears()
  {
    var handler = new PlaybackGatewayHandler(failFirstPause: false);
    using var httpClient = new HttpClient(handler);
    var monitor = new ControlledPlaybackMonitor();
    var eventClient = new GatewayPlaybackEventClient(
      httpClient,
      new StoredCredentialStore(),
      TimeSpan.FromMilliseconds(5));
    using var reporter = new PlaybackEventReporter(
      monitor,
      eventClient,
      TimeSpan.FromMinutes(1));
    await reporter.StartAsync(CancellationToken.None);

    monitor.Publish(Snapshot(PlayerPlaybackState.Playing, 90_000_000));
    await handler.WaitForAsync(item => item.EventType == "playing");
    monitor.PublishEmpty();
    var stopped = await handler.WaitForAsync(item =>
      item.EventType == "stopped");

    Assert.Equal("playerExit", stopped.Reason);
    Assert.Equal(90_000_000, stopped.PositionTicks);
    await reporter.StopAsync(CancellationToken.None);
  }

  private static PlayerPlaybackSnapshot Snapshot(
    PlayerPlaybackState state,
    long positionTicks,
    bool hasSeeked = false)
  {
    var now = DateTimeOffset.UtcNow;
    return new PlayerPlaybackSnapshot(
      PlaySessionId,
      state,
      positionTicks,
      600_000_000,
      0,
      600_000_000,
      now,
      now,
      1,
      hasSeeked,
      false);
  }

  private sealed class ControlledPlaybackMonitor : IPotPlayerPlaybackMonitor
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
      snapshot = Snapshot.Sessions.FirstOrDefault(item =>
        item.PlaySessionId == playSessionId);
      return snapshot is not null;
    }
  }

  private sealed class PlaybackGatewayHandler(bool failFirstPause)
    : HttpMessageHandler
  {
    private readonly ConcurrentQueue<ObservedRequest> requests = new();
    private int pauseFailureRemaining = failFirstPause ? 1 : 0;

    public IReadOnlyList<ObservedRequest> Requests => requests.ToArray();

    public async Task<ObservedRequest> WaitForAsync(
      Func<ObservedRequest, bool> condition)
    {
      using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(2));
      while (true)
      {
        var match = Requests.FirstOrDefault(condition);
        if (match is not null)
          return match;
        await Task.Delay(10, timeout.Token);
      }
    }

    public async Task WaitForCountAsync(
      Func<ObservedRequest, bool> condition,
      int count)
    {
      using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(2));
      while (Requests.Count(condition) < count)
        await Task.Delay(10, timeout.Token);
    }

    protected override async Task<HttpResponseMessage> SendAsync(
      HttpRequestMessage request,
      CancellationToken cancellationToken)
    {
      var payload = await request.Content!.ReadAsStringAsync(
        cancellationToken);
      using var document = JsonDocument.Parse(payload);
      var root = document.RootElement;
      var observed = new ObservedRequest(
        root.GetProperty("eventType").GetString()!,
        root.TryGetProperty("eventName", out var eventName)
          ? eventName.GetString()
          : null,
        root.TryGetProperty("reason", out var reason)
          ? reason.GetString()
          : null,
        root.GetProperty("positionTicks").GetInt64(),
        root.GetProperty("sequence").GetInt64(),
        payload,
        request.Headers.GetValues(
          BridgeDeviceAuthentication.NonceHeaderName).Single());
      requests.Enqueue(observed);

      var disconnect = observed.EventName == "pause"
        && Interlocked.Exchange(ref pauseFailureRemaining, 0) == 1;
      return new HttpResponseMessage(disconnect
        ? HttpStatusCode.ServiceUnavailable
        : HttpStatusCode.OK);
    }
  }

  private sealed record ObservedRequest(
    string EventType,
    string? EventName,
    string? Reason,
    long PositionTicks,
    long Sequence,
    string Payload,
    string Nonce);

  private sealed class StoredCredentialStore : IBridgeCredentialStore
  {
    private static readonly BridgeCredential Credential = new(
      "https://lumarelay.example.com",
      "11111111-1111-4111-8111-111111111111",
      new string('A', 43),
      ["https://lumarelay.example.com"]);

    public void Delete()
    {
    }

    public BridgeCredential? Read() => Credential;

    public void Save(BridgeCredential credential)
    {
    }
  }
}
