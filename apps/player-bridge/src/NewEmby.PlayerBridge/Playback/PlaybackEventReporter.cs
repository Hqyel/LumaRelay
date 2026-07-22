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
}

internal sealed class GatewayPlaybackEventClient(
  HttpClient httpClient,
  IBridgeCredentialStore credentialStore) : IPlaybackEventClient
{
  public async Task SendPlayingAsync(
    PlayerPlaybackSnapshot snapshot,
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
      Content = JsonContent.Create(new PlayingRequest(
        "playing",
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
        $"Gateway rejected playback start with HTTP "
        + $"{(int)response.StatusCode}.",
        null,
        response.StatusCode);
    }
  }

  private sealed record PlayingRequest(
    string EventType,
    bool IsPaused,
    Guid PlaySessionId,
    double PlaybackRate,
    long PositionTicks);
}

internal sealed class PlaybackEventReporter(
  IPotPlayerPlaybackMonitor playbackMonitor,
  IPlaybackEventClient eventClient) : IHostedService, IDisposable
{
  private readonly Channel<PlayerPlaybackMonitorSnapshot> updates =
    Channel.CreateBounded<PlayerPlaybackMonitorSnapshot>(
      new BoundedChannelOptions(1)
      {
        FullMode = BoundedChannelFullMode.DropOldest,
        SingleReader = true,
        SingleWriter = false,
      });
  private readonly HashSet<Guid> startedSessions = [];
  private CancellationTokenSource? lifetimeSource;
  private Task worker = Task.CompletedTask;

  public Task StartAsync(CancellationToken cancellationToken)
  {
    cancellationToken.ThrowIfCancellationRequested();
    if (lifetimeSource is not null)
      return Task.CompletedTask;

    lifetimeSource = new CancellationTokenSource();
    playbackMonitor.Changed += OnPlaybackChanged;
    worker = RunAsync(lifetimeSource.Token);
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
      await worker.WaitAsync(cancellationToken);
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
            || startedSessions.Contains(session.PlaySessionId))
        {
          continue;
        }

        try
        {
          await eventClient.SendPlayingAsync(session, cancellationToken);
          startedSessions.Add(session.PlaySessionId);
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
