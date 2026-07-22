using System.Net.Http.Json;
using System.Threading.Channels;
using Microsoft.Extensions.Hosting;
using NewEmby.PlayerBridge.MediaSessions;
using NewEmby.PlayerBridge.Pairing;
using NewEmby.PlayerBridge.Security;

namespace NewEmby.PlayerBridge.Playback;

internal interface IPlaybackEventClient
{
  Task SendPlayingAsync(
    PlayerPlaybackSnapshot snapshot,
    CancellationToken cancellationToken);

  Task SendProgressAsync(
    PlayerPlaybackSnapshot snapshot,
    string eventName,
    PlaybackTrackChange? trackChange,
    CancellationToken cancellationToken);
}

internal sealed record PlaybackTrackChange(
  string Kind,
  int? StreamIndex);

internal interface IPlaybackInteractionReporter
{
  Task ReportAudioTrackChangeAsync(
    Guid playSessionId,
    int streamIndex,
    CancellationToken cancellationToken);

  Task ReportSubtitleTrackChangeAsync(
    Guid playSessionId,
    int? streamIndex,
    CancellationToken cancellationToken);
}

internal sealed class GatewayPlaybackEventClient(
  HttpClient httpClient,
  IBridgeCredentialStore credentialStore) : IPlaybackEventClient
{
  public async Task SendPlayingAsync(
    PlayerPlaybackSnapshot snapshot,
    CancellationToken cancellationToken)
  {
    await SendAsync(snapshot, "playing", null, null, cancellationToken);
  }

  public async Task SendProgressAsync(
    PlayerPlaybackSnapshot snapshot,
    string eventName,
    PlaybackTrackChange? trackChange,
    CancellationToken cancellationToken)
  {
    await SendAsync(
      snapshot,
      "progress",
      eventName,
      trackChange,
      cancellationToken);
  }

  private async Task SendAsync(
    PlayerPlaybackSnapshot snapshot,
    string eventType,
    string? eventName,
    PlaybackTrackChange? trackChange,
    CancellationToken cancellationToken)
  {
    var credential = credentialStore.Read();
    if (credential is null)
      throw new InvalidOperationException("The Bridge is not paired.");

    var endpoint = new Uri(
      new Uri(credential.GatewayBaseUrl),
      $"/api/v1/bridge/devices/{credential.DeviceId}/playback-events");
    using var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
    {
      Content = JsonContent.Create(RequestBody(
        snapshot,
        eventType,
        eventName,
        trackChange)),
    };
    BridgeDeviceAuthentication.Apply(
      request,
      credential,
      BridgeDeviceAuthentication.CreateNonce());
    using var response = await httpClient.SendAsync(
      request,
      cancellationToken);
    if (!response.IsSuccessStatusCode)
    {
      throw new HttpRequestException(
        $"Gateway rejected playback event with HTTP "
        + $"{(int)response.StatusCode}.",
        null,
        response.StatusCode);
    }
  }

  private static Dictionary<string, object?> RequestBody(
    PlayerPlaybackSnapshot snapshot,
    string eventType,
    string? eventName,
    PlaybackTrackChange? trackChange)
  {
    var body = new Dictionary<string, object?>
    {
      ["eventType"] = eventType,
      ["isPaused"] = snapshot.IsPaused(),
      ["playSessionId"] = snapshot.PlaySessionId,
      ["playbackRate"] = snapshot.PlaybackRate,
      ["positionTicks"] = snapshot.PositionTicks,
    };
    if (eventName is not null)
      body["eventName"] = eventName;
    if (trackChange?.Kind == "audio")
      body["audioStreamIndex"] = trackChange.StreamIndex;
    if (trackChange?.Kind == "subtitle")
      body["subtitleStreamIndex"] = trackChange.StreamIndex;
    return body;
  }
}

internal sealed class PlaybackEventReporter
  : IPlaybackInteractionReporter, IHostedService, IDisposable
{
  private static readonly TimeSpan DefaultProgressInterval =
    TimeSpan.FromSeconds(10);

  private readonly IPlaybackEventClient eventClient;
  private readonly IPotPlayerPlaybackMonitor playbackMonitor;
  private readonly TimeSpan progressInterval;
  private readonly Channel<PlayerPlaybackMonitorSnapshot> updates =
    Channel.CreateBounded<PlayerPlaybackMonitorSnapshot>(
      new BoundedChannelOptions(1)
      {
        FullMode = BoundedChannelFullMode.DropOldest,
        SingleReader = true,
        SingleWriter = false,
      });
  private readonly HashSet<Guid> startedSessions = [];
  private readonly Dictionary<Guid, PlayerPlaybackSnapshot> lastSnapshots =
    [];
  private readonly object sync = new();
  private Task heartbeatWorker = Task.CompletedTask;
  private CancellationTokenSource? lifetimeSource;
  private Task worker = Task.CompletedTask;

  public PlaybackEventReporter(
    IPotPlayerPlaybackMonitor playbackMonitor,
    IPlaybackEventClient eventClient,
    TimeSpan? progressInterval = null)
  {
    this.playbackMonitor = playbackMonitor;
    this.eventClient = eventClient;
    this.progressInterval = progressInterval ?? DefaultProgressInterval;
    if (this.progressInterval <= TimeSpan.Zero)
    {
      throw new ArgumentOutOfRangeException(nameof(progressInterval));
    }
  }

  public Task StartAsync(CancellationToken cancellationToken)
  {
    cancellationToken.ThrowIfCancellationRequested();
    if (lifetimeSource is not null)
      return Task.CompletedTask;

    lifetimeSource = new CancellationTokenSource();
    playbackMonitor.Changed += OnPlaybackChanged;
    worker = RunAsync(lifetimeSource.Token);
    heartbeatWorker = RunHeartbeatAsync(lifetimeSource.Token);
    QueueCurrentSnapshot();
    return Task.CompletedTask;
  }

  public async Task StopAsync(CancellationToken cancellationToken)
  {
    var source = lifetimeSource;
    lifetimeSource = null;
    if (source is null)
      return;

    playbackMonitor.Changed -= OnPlaybackChanged;
    source.Cancel();
    updates.Writer.TryComplete();
    try
    {
      await Task.WhenAll(worker, heartbeatWorker)
        .WaitAsync(cancellationToken);
    }
    catch (OperationCanceledException) when (source.IsCancellationRequested)
    {
    }
    finally
    {
      source.Dispose();
    }
  }

  public void Dispose()
  {
    playbackMonitor.Changed -= OnPlaybackChanged;
    var source = Interlocked.Exchange(ref lifetimeSource, null);
    if (source is null)
      return;

    source.Cancel();
    source.Dispose();
  }

  public async Task ReportAudioTrackChangeAsync(
    Guid playSessionId,
    int streamIndex,
    CancellationToken cancellationToken)
  {
    ArgumentOutOfRangeException.ThrowIfNegative(streamIndex);
    await ReportTrackChangeAsync(
      playSessionId,
      "audioTrackChange",
      new PlaybackTrackChange("audio", streamIndex),
      cancellationToken);
  }

  public async Task ReportSubtitleTrackChangeAsync(
    Guid playSessionId,
    int? streamIndex,
    CancellationToken cancellationToken)
  {
    if (streamIndex.HasValue)
      ArgumentOutOfRangeException.ThrowIfNegative(streamIndex.Value);
    await ReportTrackChangeAsync(
      playSessionId,
      "subtitleTrackChange",
      new PlaybackTrackChange("subtitle", streamIndex),
      cancellationToken);
  }

  private void OnPlaybackChanged(object? sender, EventArgs eventArgs)
  {
    QueueCurrentSnapshot();
  }

  private void QueueCurrentSnapshot()
  {
    updates.Writer.TryWrite(playbackMonitor.Snapshot);
  }

  private async Task RunAsync(CancellationToken cancellationToken)
  {
    await foreach (var snapshot in updates.Reader.ReadAllAsync(
      cancellationToken))
    {
      foreach (var session in snapshot.Sessions)
      {
        if (!CanReportStart(session))
          continue;

        if (!HasStarted(session.PlaySessionId))
        {
          try
          {
            await eventClient.SendPlayingAsync(session, cancellationToken);
            MarkStarted(session.PlaySessionId);
            Remember(session);
          }
          catch (OperationCanceledException) when (cancellationToken
            .IsCancellationRequested)
          {
            throw;
          }
          catch
          {
            // A later monitor change retries the start check-in.
          }

          continue;
        }

        var previous = Previous(session.PlaySessionId);
        foreach (var eventName in ImmediateEvents(previous, session))
        {
          try
          {
            await eventClient.SendProgressAsync(
              session,
              eventName,
              null,
              cancellationToken);
          }
          catch (OperationCanceledException) when (cancellationToken
            .IsCancellationRequested)
          {
            throw;
          }
          catch
          {
            // Periodic progress will reconcile a transient failure.
          }
        }

        Remember(session);
      }
    }
  }

  private async Task RunHeartbeatAsync(CancellationToken cancellationToken)
  {
    using var timer = new PeriodicTimer(progressInterval);
    while (await timer.WaitForNextTickAsync(cancellationToken))
    {
      foreach (var session in playbackMonitor.Snapshot.Sessions)
      {
        if (!CanReportStart(session)
            || !HasStarted(session.PlaySessionId))
        {
          continue;
        }

        try
        {
          await eventClient.SendProgressAsync(
            session,
            "timeUpdate",
            null,
            cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken
          .IsCancellationRequested)
        {
          throw;
        }
        catch
        {
          // The next ten-second heartbeat retries a transient failure.
        }
      }
    }
  }

  private bool HasStarted(Guid playSessionId)
  {
    lock (sync)
      return startedSessions.Contains(playSessionId);
  }

  private void MarkStarted(Guid playSessionId)
  {
    lock (sync)
      startedSessions.Add(playSessionId);
  }

  private PlayerPlaybackSnapshot? Previous(Guid playSessionId)
  {
    lock (sync)
      return lastSnapshots.GetValueOrDefault(playSessionId);
  }

  private void Remember(PlayerPlaybackSnapshot snapshot)
  {
    lock (sync)
      lastSnapshots[snapshot.PlaySessionId] = snapshot;
  }

  private async Task ReportTrackChangeAsync(
    Guid playSessionId,
    string eventName,
    PlaybackTrackChange trackChange,
    CancellationToken cancellationToken)
  {
    if (!HasStarted(playSessionId)
        || !playbackMonitor.TryGetSnapshot(playSessionId, out var snapshot)
        || snapshot is null
        || !CanReportStart(snapshot))
    {
      throw new InvalidOperationException(
        "The playback session is not ready for a track change.");
    }

    await eventClient.SendProgressAsync(
      snapshot,
      eventName,
      trackChange,
      cancellationToken);
  }

  private static List<string> ImmediateEvents(
    PlayerPlaybackSnapshot? previous,
    PlayerPlaybackSnapshot current)
  {
    if (previous is null)
      return [];

    var events = new List<string>();
    if (previous.State == PlayerPlaybackState.Playing
        && current.State == PlayerPlaybackState.Paused)
    {
      events.Add("pause");
    }
    if (previous.State == PlayerPlaybackState.Paused
        && current.State == PlayerPlaybackState.Playing)
    {
      events.Add("unpause");
    }
    if (current.HasSeeked
        && current.PositionTicks != previous.PositionTicks)
    {
      events.Add("seek");
    }
    if (Math.Abs(current.PlaybackRate - previous.PlaybackRate) > 0.001)
      events.Add("playbackRateChange");
    return events;
  }

  private static bool CanReportStart(PlayerPlaybackSnapshot snapshot)
  {
    return !snapshot.IsTimelineStale
      && (snapshot.State == PlayerPlaybackState.Playing
        || snapshot.State == PlayerPlaybackState.Paused);
  }
}

internal static class PlayerPlaybackSnapshotExtensions
{
  public static bool IsPaused(this PlayerPlaybackSnapshot snapshot)
  {
    return snapshot.State == PlayerPlaybackState.Paused;
  }
}
