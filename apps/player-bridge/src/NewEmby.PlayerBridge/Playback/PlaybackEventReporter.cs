using System.Net.Http.Json;
using System.Text.Json;
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

  Task SendStoppedAsync(
    PlayerPlaybackSnapshot snapshot,
    string reason,
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

internal sealed class GatewayPlaybackEventClient : IPlaybackEventClient
{
  private static readonly TimeSpan DefaultRetryDelay =
    TimeSpan.FromSeconds(2);

  private readonly IBridgeCredentialStore credentialStore;
  private readonly HttpClient httpClient;
  private readonly TimeSpan retryDelay;
  private readonly Dictionary<Guid, SequenceState> sequences = [];
  private readonly object sync = new();

  public GatewayPlaybackEventClient(
    HttpClient httpClient,
    IBridgeCredentialStore credentialStore,
    TimeSpan? retryDelay = null)
  {
    this.httpClient = httpClient;
    this.credentialStore = credentialStore;
    this.retryDelay = retryDelay ?? DefaultRetryDelay;
    if (this.retryDelay <= TimeSpan.Zero)
      throw new ArgumentOutOfRangeException(nameof(retryDelay));
  }

  public async Task SendPlayingAsync(
    PlayerPlaybackSnapshot snapshot,
    CancellationToken cancellationToken)
  {
    await SendAsync(
      snapshot,
      "playing",
      null,
      null,
      null,
      cancellationToken);
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
      null,
      trackChange,
      cancellationToken);
  }

  public async Task SendStoppedAsync(
    PlayerPlaybackSnapshot snapshot,
    string reason,
    CancellationToken cancellationToken)
  {
    await SendAsync(
      snapshot,
      "stopped",
      null,
      reason,
      null,
      cancellationToken);
  }

  private async Task SendAsync(
    PlayerPlaybackSnapshot snapshot,
    string eventType,
    string? eventName,
    string? reason,
    PlaybackTrackChange? trackChange,
    CancellationToken cancellationToken)
  {
    var state = SequenceFor(snapshot.PlaySessionId);
    await state.Gate.WaitAsync(cancellationToken);
    try
    {
      var sequence = state.LastSequence + 1;
      while (true)
      {
        cancellationToken.ThrowIfCancellationRequested();
        var credential = credentialStore.Read();
        if (credential is null)
          throw new InvalidOperationException("The Bridge is not paired.");

        var endpoint = new Uri(
          new Uri(credential.GatewayBaseUrl),
          $"/api/v1/bridge/devices/{credential.DeviceId}/playback-events");
        try
        {
          using var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
          {
            Content = JsonContent.Create(RequestBody(
              snapshot,
              eventType,
              eventName,
              reason,
              sequence,
              trackChange)),
          };
          BridgeDeviceAuthentication.Apply(
            request,
            credential,
            BridgeDeviceAuthentication.CreateNonce());
          using var response = await httpClient.SendAsync(
            request,
            cancellationToken);
          if (response.IsSuccessStatusCode)
          {
            state.LastSequence = sequence;
            return;
          }

          if (!await IsRetryableAsync(response, cancellationToken))
          {
            throw new InvalidOperationException(
              $"Gateway rejected playback event with HTTP "
              + $"{(int)response.StatusCode}.");
          }
        }
        catch (HttpRequestException)
        {
          // Keep this event and sequence until connectivity recovers.
        }
        catch (TaskCanceledException) when (!cancellationToken
          .IsCancellationRequested)
        {
          // HttpClient timeout is treated as a temporary disconnection.
        }

        await Task.Delay(retryDelay, cancellationToken);
      }
    }
    finally
    {
      state.Gate.Release();
    }
  }

  private SequenceState SequenceFor(Guid playSessionId)
  {
    lock (sync)
    {
      if (!sequences.TryGetValue(playSessionId, out var state))
      {
        state = new SequenceState();
        sequences.Add(playSessionId, state);
      }

      return state;
    }
  }

  private static async Task<bool> IsRetryableAsync(
    HttpResponseMessage response,
    CancellationToken cancellationToken)
  {
    var statusCode = (int)response.StatusCode;
    if (statusCode == 408 || statusCode == 429 || statusCode >= 500)
      return true;
    if (statusCode != 409)
      return false;

    try
    {
      using var payload = await JsonDocument.ParseAsync(
        await response.Content.ReadAsStreamAsync(cancellationToken),
        cancellationToken: cancellationToken);
      if (!payload.RootElement.TryGetProperty("error", out var error)
        || !error.TryGetProperty("code", out var code))
      {
        return false;
      }

      return code.GetString() == "PLAYBACK_EVENT_PENDING";
    }
    catch (JsonException)
    {
      return false;
    }
  }

  private static Dictionary<string, object?> RequestBody(
    PlayerPlaybackSnapshot snapshot,
    string eventType,
    string? eventName,
    string? reason,
    long sequence,
    PlaybackTrackChange? trackChange)
  {
    var body = new Dictionary<string, object?>
    {
      ["eventType"] = eventType,
      ["isPaused"] = snapshot.IsPaused(),
      ["playSessionId"] = snapshot.PlaySessionId,
      ["playbackRate"] = snapshot.PlaybackRate,
      ["positionTicks"] = snapshot.PositionTicks,
      ["sequence"] = sequence,
    };
    if (eventName is not null)
      body["eventName"] = eventName;
    if (reason is not null)
      body["reason"] = reason;
    if (trackChange?.Kind == "audio")
      body["audioStreamIndex"] = trackChange.StreamIndex;
    if (trackChange?.Kind == "subtitle")
      body["subtitleStreamIndex"] = trackChange.StreamIndex;
    return body;
  }

  private sealed class SequenceState
  {
    public SemaphoreSlim Gate { get; } = new(1, 1);

    public long LastSequence { get; set; }
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
  private readonly HashSet<Guid> stoppedSessions = [];
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
    await ReportRemainingStoppedAsync("bridgeExit", cancellationToken);
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
        if (HasStarted(session.PlaySessionId)
            && IsTerminal(session.State))
        {
          await TryReportStoppedAsync(
            session,
            session.State == PlayerPlaybackState.Ended
              ? "ended"
              : "userExit",
            cancellationToken);
          Remember(session);
          continue;
        }

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

      var currentIds = snapshot.Sessions
        .Select(session => session.PlaySessionId)
        .ToHashSet();
      foreach (var playSessionId in StartedSessionIds())
      {
        if (currentIds.Contains(playSessionId)
            || HasStopped(playSessionId))
        {
          continue;
        }

        var previous = Previous(playSessionId);
        if (previous is not null)
        {
          await TryReportStoppedAsync(
            previous,
            "playerExit",
            cancellationToken);
        }
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
            || !HasStarted(session.PlaySessionId)
            || HasStopped(session.PlaySessionId))
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

  private bool HasStopped(Guid playSessionId)
  {
    lock (sync)
      return stoppedSessions.Contains(playSessionId);
  }

  private void MarkStopped(Guid playSessionId)
  {
    lock (sync)
      stoppedSessions.Add(playSessionId);
  }

  private Guid[] StartedSessionIds()
  {
    lock (sync)
      return startedSessions.ToArray();
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

  private async Task ReportRemainingStoppedAsync(
    string reason,
    CancellationToken cancellationToken)
  {
    foreach (var playSessionId in StartedSessionIds())
    {
      if (HasStopped(playSessionId))
        continue;

      var snapshot = Previous(playSessionId);
      if (snapshot is not null)
        await TryReportStoppedAsync(snapshot, reason, cancellationToken);
    }
  }

  private async Task TryReportStoppedAsync(
    PlayerPlaybackSnapshot snapshot,
    string reason,
    CancellationToken cancellationToken)
  {
    if (HasStopped(snapshot.PlaySessionId))
      return;

    try
    {
      await eventClient.SendStoppedAsync(
        snapshot,
        reason,
        cancellationToken);
      MarkStopped(snapshot.PlaySessionId);
    }
    catch (OperationCanceledException) when (cancellationToken
      .IsCancellationRequested)
    {
      throw;
    }
    catch
    {
      // A later terminal observation or offline queue retries Stopped.
    }
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

  private static bool IsTerminal(PlayerPlaybackState state)
  {
    return state == PlayerPlaybackState.Ended
      || state == PlayerPlaybackState.Stopped
      || state == PlayerPlaybackState.Closed;
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
