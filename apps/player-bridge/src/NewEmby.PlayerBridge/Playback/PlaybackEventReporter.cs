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
    await SendAsync(snapshot, "playing", null, cancellationToken);
  }

  public async Task SendProgressAsync(
    PlayerPlaybackSnapshot snapshot,
    CancellationToken cancellationToken)
  {
    await SendAsync(snapshot, "progress", "timeUpdate", cancellationToken);
  }

  private async Task SendAsync(
    PlayerPlaybackSnapshot snapshot,
    string eventType,
    string? eventName,
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
      Content = JsonContent.Create(new PlaybackRequest(
        eventName,
        eventType,
        snapshot.IsPaused(),
        snapshot.PlaySessionId,
        snapshot.PlaybackRate,
        snapshot.PositionTicks)),
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

  private sealed record PlaybackRequest(
    string? EventName,
    string EventType,
    bool IsPaused,
    Guid PlaySessionId,
    double PlaybackRate,
    long PositionTicks);
}

internal sealed class PlaybackEventReporter : IHostedService, IDisposable
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
    lifetimeSource?.Cancel();
    lifetimeSource?.Dispose();
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
        if (!CanReportStart(session)
            || HasStarted(session.PlaySessionId))
        {
          continue;
        }

        try
        {
          await eventClient.SendPlayingAsync(session, cancellationToken);
          MarkStarted(session.PlaySessionId);
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
          await eventClient.SendProgressAsync(session, cancellationToken);
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
