using System.Runtime.InteropServices;
using Microsoft.Extensions.Hosting;

namespace LumaRelay.PlayerBridge.MediaSessions;

internal enum PlayerPlaybackState
{
  Unknown,
  Closed,
  Opened,
  Changing,
  Stopped,
  Playing,
  Paused,
  Ended,
}

internal sealed record PlayerPlaybackSnapshot(
  Guid PlaySessionId,
  PlayerPlaybackState State,
  long PositionTicks,
  long DurationTicks,
  long MinimumSeekTicks,
  long MaximumSeekTicks,
  DateTimeOffset TimelineUpdatedAt,
  DateTimeOffset ObservedAt,
  double PlaybackRate,
  bool HasSeeked,
  bool IsTimelineStale);

internal sealed record PlayerPlaybackMonitorSnapshot(
  IReadOnlyList<PlayerPlaybackSnapshot> Sessions)
{
  public static PlayerPlaybackMonitorSnapshot Empty { get; } = new([]);
}

internal interface IPotPlayerPlaybackMonitor
{
  event EventHandler? Changed;

  PlayerPlaybackMonitorSnapshot Snapshot { get; }

  bool TryGetSnapshot(
    Guid playSessionId,
    out PlayerPlaybackSnapshot? snapshot);
}

internal sealed class PotPlayerPlaybackMonitor
  : IPotPlayerPlaybackMonitor, IHostedService, IDisposable
{
  private static readonly TimeSpan RefreshInterval =
    TimeSpan.FromSeconds(1);

  private readonly SemaphoreSlim refreshGate = new(1, 1);
  private readonly IPotPlayerSessionMatcher sessionMatcher;
  private readonly Dictionary<Guid, ISmtcSession> subscriptions = [];
  private readonly object sync = new();
  private readonly TimeProvider timeProvider;
  private CancellationTokenSource? lifetimeSource;
  private Task periodicTask = Task.CompletedTask;
  private PlayerPlaybackMonitorSnapshot snapshot =
    PlayerPlaybackMonitorSnapshot.Empty;

  public PotPlayerPlaybackMonitor(
    IPotPlayerSessionMatcher sessionMatcher,
    TimeProvider? timeProvider = null)
  {
    this.sessionMatcher = sessionMatcher;
    this.timeProvider = timeProvider ?? TimeProvider.System;
  }

  public event EventHandler? Changed;

  public PlayerPlaybackMonitorSnapshot Snapshot
  {
    get
    {
      lock (sync)
        return snapshot;
    }
  }

  public Task StartAsync(CancellationToken cancellationToken)
  {
    cancellationToken.ThrowIfCancellationRequested();

    lock (sync)
    {
      if (lifetimeSource is not null)
        return Task.CompletedTask;

      lifetimeSource = new CancellationTokenSource();
    }

    sessionMatcher.Changed += OnMatcherChanged;
    periodicTask = RunPeriodicRefreshAsync(lifetimeSource.Token);
    QueueRefresh();
    return Task.CompletedTask;
  }

  public async Task StopAsync(CancellationToken cancellationToken)
  {
    CancellationTokenSource? source;
    lock (sync)
    {
      source = lifetimeSource;
      lifetimeSource = null;
    }

    if (source is null)
      return;

    sessionMatcher.Changed -= OnMatcherChanged;
    source.Cancel();

    try
    {
      await periodicTask.WaitAsync(cancellationToken);
    }
    catch (OperationCanceledException) when (source.IsCancellationRequested)
    {
    }
    finally
    {
      await refreshGate.WaitAsync(CancellationToken.None);
      try
      {
        DetachAllSessions();
      }
      finally
      {
        refreshGate.Release();
      }

      source.Dispose();
    }
  }

  public void Dispose()
  {
    CancellationTokenSource? source;
    lock (sync)
    {
      source = lifetimeSource;
      lifetimeSource = null;
    }

    sessionMatcher.Changed -= OnMatcherChanged;
    source?.Cancel();
    source?.Dispose();
    DetachAllSessions();
    refreshGate.Dispose();
  }

  public bool TryGetSnapshot(
    Guid playSessionId,
    out PlayerPlaybackSnapshot? result)
  {
    result = Snapshot.Sessions.FirstOrDefault(item =>
      item.PlaySessionId == playSessionId);
    return result is not null;
  }

  internal async Task RefreshAsync(CancellationToken cancellationToken)
  {
    await refreshGate.WaitAsync(cancellationToken);

    try
    {
      Evaluate();
    }
    finally
    {
      refreshGate.Release();
    }
  }

  private void Evaluate()
  {
    var matches = sessionMatcher.Snapshot.Matches
      .Where(item =>
        item.State == PlayerSessionMatchState.Matched
        && item.Session is not null)
      .ToArray();
    SyncSessionSubscriptions(matches);

    var previous = Snapshot;
    var now = timeProvider.GetUtcNow();
    var sessions = new List<PlayerPlaybackSnapshot>();

    foreach (var match in matches)
    {
      try
      {
        var session = match.Session!;
        var prior = previous.Sessions.FirstOrDefault(item =>
          item.PlaySessionId == match.PlaySessionId);
        sessions.Add(PlayerPlaybackNormalizer.Normalize(
          match.PlaySessionId,
          session.GetPlaybackInfo(),
          session.GetTimelineProperties(),
          prior,
          now));
      }
      catch (Exception exception) when (IsExpectedFailure(exception))
      {
      }
    }

    var next = new PlayerPlaybackMonitorSnapshot(
      sessions.OrderBy(item => item.PlaySessionId).ToArray());
    var changed = !HasSameSnapshot(previous, next);

    lock (sync)
      snapshot = next;

    if (changed)
      Changed?.Invoke(this, EventArgs.Empty);
  }

  private void SyncSessionSubscriptions(
    IReadOnlyList<PlayerSessionMatch> matches)
  {
    var desired = matches.ToDictionary(
      item => item.PlaySessionId,
      item => item.Session!);

    foreach (var current in subscriptions.ToArray())
    {
      if (desired.TryGetValue(current.Key, out var session)
        && ReferenceEquals(current.Value, session))
      {
        continue;
      }

      DetachSession(current.Value);
      subscriptions.Remove(current.Key);
    }

    foreach (var target in desired)
    {
      if (subscriptions.ContainsKey(target.Key))
        continue;

      AttachSession(target.Value);
      subscriptions[target.Key] = target.Value;
    }
  }

  private void AttachSession(ISmtcSession session)
  {
    session.PlaybackInfoChanged += OnPlaybackInfoChanged;
    session.TimelinePropertiesChanged += OnTimelinePropertiesChanged;
  }

  private void DetachSession(ISmtcSession session)
  {
    session.PlaybackInfoChanged -= OnPlaybackInfoChanged;
    session.TimelinePropertiesChanged -= OnTimelinePropertiesChanged;
  }

  private void DetachAllSessions()
  {
    foreach (var session in subscriptions.Values)
      DetachSession(session);

    subscriptions.Clear();
  }

  private async Task RunPeriodicRefreshAsync(
    CancellationToken cancellationToken)
  {
    using var timer = new PeriodicTimer(
      RefreshInterval,
      timeProvider);

    try
    {
      while (await timer.WaitForNextTickAsync(cancellationToken))
      {
        if (sessionMatcher.Snapshot.Matches.Count > 0)
          await RefreshSafelyAsync(cancellationToken);
      }
    }
    catch (OperationCanceledException) when (
      cancellationToken.IsCancellationRequested)
    {
    }
  }

  private void OnMatcherChanged(object? sender, EventArgs args)
  {
    QueueRefresh();
  }

  private void OnPlaybackInfoChanged(object? sender, EventArgs args)
  {
    QueueRefresh();
  }

  private void OnTimelinePropertiesChanged(object? sender, EventArgs args)
  {
    QueueRefresh();
  }

  private void QueueRefresh()
  {
    CancellationToken cancellationToken;
    lock (sync)
    {
      if (lifetimeSource is null)
        return;

      cancellationToken = lifetimeSource.Token;
    }

    _ = RefreshSafelyAsync(cancellationToken);
  }

  private async Task RefreshSafelyAsync(
    CancellationToken cancellationToken)
  {
    try
    {
      await RefreshAsync(cancellationToken);
    }
    catch (OperationCanceledException) when (
      cancellationToken.IsCancellationRequested)
    {
    }
    catch (Exception exception) when (IsExpectedFailure(exception))
    {
    }
  }

  private static bool HasSameSnapshot(
    PlayerPlaybackMonitorSnapshot first,
    PlayerPlaybackMonitorSnapshot second)
  {
    return first.Sessions.Count == second.Sessions.Count
      && first.Sessions.Zip(second.Sessions).All(pair =>
        pair.First with { ObservedAt = default }
          == pair.Second with { ObservedAt = default });
  }

  private static bool IsExpectedFailure(Exception exception)
  {
    return exception is COMException
      or UnauthorizedAccessException
      or InvalidOperationException
      or IOException
      or NotSupportedException
      or ObjectDisposedException
      or PlatformNotSupportedException
      or TypeLoadException;
  }
}

internal static class PlayerPlaybackNormalizer
{
  private static readonly long EndToleranceTicks =
    TimeSpan.FromSeconds(2).Ticks;
  private static readonly long SeekToleranceTicks =
    TimeSpan.FromSeconds(2).Ticks;
  private static readonly TimeSpan StaleTolerance =
    TimeSpan.FromSeconds(5);
  private static readonly TimeSpan FutureTolerance =
    TimeSpan.FromSeconds(2);

  public static PlayerPlaybackSnapshot Normalize(
    Guid playSessionId,
    SmtcPlaybackInfo playback,
    SmtcTimelineProperties timeline,
    PlayerPlaybackSnapshot? previous,
    DateTimeOffset observedAt)
  {
    var duration = PositiveDifference(
      timeline.EndTicks,
      timeline.StartTicks);
    var position = RelativeTicks(
      timeline.PositionTicks,
      timeline.StartTicks,
      duration);
    var minimumSeek = RelativeTicks(
      timeline.MinSeekTicks,
      timeline.StartTicks,
      duration);
    var maximumSeek = RelativeTicks(
      timeline.MaxSeekTicks,
      timeline.StartTicks,
      duration);
    if (maximumSeek < minimumSeek)
      maximumSeek = minimumSeek;

    var state = MapState(playback.State);
    var isAtEnd = duration > 0
      && duration - position <= EndToleranceTicks;
    var resetAfterEnd = duration == 0
      && previous is not null
      && previous.DurationTicks > 0
      && previous.DurationTicks - previous.PositionTicks
        <= EndToleranceTicks;
    if (previous?.State == PlayerPlaybackState.Ended
      || (IsTerminal(state) && isAtEnd)
      || resetAfterEnd)
    {
      state = PlayerPlaybackState.Ended;
      if (duration == 0 && previous is not null)
      {
        duration = previous.DurationTicks;
        position = previous.DurationTicks;
        minimumSeek = previous.MinimumSeekTicks;
        maximumSeek = previous.MaximumSeekTicks;
      }
    }

    var playbackRate = double.IsFinite(playback.PlaybackRate)
      && playback.PlaybackRate > 0
      ? playback.PlaybackRate
      : 0;
    var hasSeeked = DetectSeek(
      previous,
      state,
      position,
      duration,
      timeline.LastUpdatedAt);
    var isTimelineStale = state == PlayerPlaybackState.Playing
      && (playbackRate == 0
        || timeline.LastUpdatedAt == default
        || timeline.LastUpdatedAt > observedAt + FutureTolerance
        || observedAt - timeline.LastUpdatedAt > StaleTolerance);

    return new PlayerPlaybackSnapshot(
      playSessionId,
      state,
      position,
      duration,
      minimumSeek,
      maximumSeek,
      timeline.LastUpdatedAt,
      observedAt,
      playbackRate,
      hasSeeked,
      isTimelineStale);
  }

  private static bool DetectSeek(
    PlayerPlaybackSnapshot? previous,
    PlayerPlaybackState state,
    long positionTicks,
    long durationTicks,
    DateTimeOffset updatedAt)
  {
    if (previous is null
      || previous.State == PlayerPlaybackState.Ended
      || state == PlayerPlaybackState.Ended
      || previous.DurationTicks != durationTicks
      || updatedAt <= previous.TimelineUpdatedAt)
    {
      return false;
    }

    var elapsed = updatedAt - previous.TimelineUpdatedAt;
    var expectedDelta = previous.State == PlayerPlaybackState.Playing
      ? elapsed.Ticks * previous.PlaybackRate
      : 0;
    var actualDelta = positionTicks - previous.PositionTicks;
    return Math.Abs(actualDelta - expectedDelta) > SeekToleranceTicks;
  }

  private static long PositiveDifference(long value, long origin)
  {
    var difference = (decimal)value - origin;
    if (difference <= 0)
      return 0;

    return difference >= long.MaxValue
      ? long.MaxValue
      : (long)difference;
  }

  private static long RelativeTicks(
    long value,
    long origin,
    long duration)
  {
    if (duration == 0)
      return 0;

    var relative = (decimal)value - origin;
    if (relative <= 0)
      return 0;
    if (relative >= duration)
      return duration;

    return (long)relative;
  }

  private static PlayerPlaybackState MapState(SmtcPlaybackState state)
  {
    return state switch
    {
      SmtcPlaybackState.Closed => PlayerPlaybackState.Closed,
      SmtcPlaybackState.Opened => PlayerPlaybackState.Opened,
      SmtcPlaybackState.Changing => PlayerPlaybackState.Changing,
      SmtcPlaybackState.Stopped => PlayerPlaybackState.Stopped,
      SmtcPlaybackState.Playing => PlayerPlaybackState.Playing,
      SmtcPlaybackState.Paused => PlayerPlaybackState.Paused,
      _ => PlayerPlaybackState.Unknown,
    };
  }

  private static bool IsTerminal(PlayerPlaybackState state)
  {
    return state is PlayerPlaybackState.Closed
      or PlayerPlaybackState.Stopped;
  }
}
