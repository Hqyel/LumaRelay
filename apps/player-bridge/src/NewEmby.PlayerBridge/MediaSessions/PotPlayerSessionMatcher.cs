using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using Microsoft.Extensions.Hosting;
using NewEmby.PlayerBridge.Players;

namespace NewEmby.PlayerBridge.MediaSessions;

internal enum PlayerSessionMatchState
{
  Awaiting,
  Matched,
  Ambiguous,
  ProcessExited,
  TimedOut,
}

internal sealed record PlayerSessionMatch(
  Guid PlaySessionId,
  int ProcessId,
  DateTimeOffset StartedAt,
  PlayerSessionMatchState State,
  ISmtcSession? Session,
  DateTimeOffset UpdatedAt);

internal sealed record PlayerSessionMatcherSnapshot(
  IReadOnlyList<PlayerSessionMatch> Matches)
{
  public static PlayerSessionMatcherSnapshot Empty { get; } = new([]);
}

internal interface IPlayerProcessLifetime
{
  bool IsAlive(PlayerLaunchResult launch);
}

internal interface IPotPlayerSessionMatcher : IPlayerLaunchTracker
{
  event EventHandler? Changed;

  PlayerSessionMatcherSnapshot Snapshot { get; }

  bool TryGetMatchedSession(
    Guid playSessionId,
    out ISmtcSession? session);

  void Untrack(Guid playSessionId);
}

internal sealed class PotPlayerSessionMatcher
  : IPotPlayerSessionMatcher, IHostedService, IDisposable
{
  private static readonly TimeSpan DefaultMatchWindow =
    TimeSpan.FromSeconds(15);
  private static readonly TimeSpan RefreshInterval =
    TimeSpan.FromSeconds(1);

  private readonly TimeSpan matchWindow;
  private readonly ISystemMediaSessionMonitor monitor;
  private readonly IPlayerProcessLifetime processLifetime;
  private readonly SemaphoreSlim refreshGate = new(1, 1);
  private readonly object sync = new();
  private readonly TimeProvider timeProvider;
  private CancellationTokenSource? lifetimeSource;
  private Dictionary<Guid, PlayerLaunchResult> launches = [];
  private Task periodicTask = Task.CompletedTask;
  private PlayerSessionMatcherSnapshot snapshot =
    PlayerSessionMatcherSnapshot.Empty;

  public PotPlayerSessionMatcher(
    ISystemMediaSessionMonitor monitor,
    IPlayerProcessLifetime? processLifetime = null,
    TimeProvider? timeProvider = null,
    TimeSpan? matchWindow = null)
  {
    this.monitor = monitor;
    this.processLifetime = processLifetime
      ?? new WindowsPlayerProcessLifetime();
    this.timeProvider = timeProvider ?? TimeProvider.System;
    this.matchWindow = matchWindow ?? DefaultMatchWindow;
  }

  public event EventHandler? Changed;

  public PlayerSessionMatcherSnapshot Snapshot
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

    monitor.Changed += OnMonitorChanged;
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

    monitor.Changed -= OnMonitorChanged;
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
      source.Dispose();
    }
  }

  public void Track(PlayerLaunchResult result)
  {
    if (result.ProcessId <= 0 || result.PlaySessionId == Guid.Empty)
      throw new ArgumentException("The player launch result is invalid.");

    lock (sync)
      launches[result.PlaySessionId] = result;

    QueueRefresh();
  }

  public void Dispose()
  {
    CancellationTokenSource? source;
    lock (sync)
    {
      source = lifetimeSource;
      lifetimeSource = null;
    }

    source?.Cancel();
    source?.Dispose();
    refreshGate.Dispose();
  }

  public bool TryGetMatchedSession(
    Guid playSessionId,
    out ISmtcSession? session)
  {
    var match = Snapshot.Matches.FirstOrDefault(item =>
      item.PlaySessionId == playSessionId
      && item.State == PlayerSessionMatchState.Matched);
    session = match?.Session;
    return session is not null;
  }

  public void Untrack(Guid playSessionId)
  {
    bool changed;
    lock (sync)
    {
      launches.Remove(playSessionId);
      var matches = snapshot.Matches
        .Where(item => item.PlaySessionId != playSessionId)
        .ToArray();
      changed = matches.Length != snapshot.Matches.Count;
      snapshot = new PlayerSessionMatcherSnapshot(matches);
    }

    if (changed)
      Changed?.Invoke(this, EventArgs.Empty);
  }

  internal async Task RefreshAsync(CancellationToken cancellationToken)
  {
    await refreshGate.WaitAsync(cancellationToken);

    try
    {
      await EvaluateAsync(cancellationToken);
    }
    finally
    {
      refreshGate.Release();
    }
  }

  private async Task EvaluateAsync(CancellationToken cancellationToken)
  {
    PlayerLaunchResult[] currentLaunches;
    lock (sync)
      currentLaunches = launches.Values.ToArray();

    if (currentLaunches.Length == 0)
      return;

    var sessions = await ReadPotPlayerSessionsAsync(cancellationToken);
    var now = timeProvider.GetUtcNow();
    var titleCounts = currentLaunches
      .GroupBy(
        launch => launch.SessionTitle,
        StringComparer.OrdinalIgnoreCase)
      .ToDictionary(
        group => group.Key,
        group => group.Count(),
        StringComparer.OrdinalIgnoreCase);
    var matches = currentLaunches
      .Select(launch => MatchLaunch(
        launch,
        sessions,
        now,
        titleCounts[launch.SessionTitle] > 1))
      .OrderBy(match => match.StartedAt)
      .ToArray();
    var nextSnapshot = new PlayerSessionMatcherSnapshot(matches);
    var changed = !HasSameMatches(Snapshot, nextSnapshot);

    lock (sync)
      snapshot = nextSnapshot;

    if (changed)
      Changed?.Invoke(this, EventArgs.Empty);
  }

  private async Task<IReadOnlyList<ObservedSmtcSession>>
    ReadPotPlayerSessionsAsync(CancellationToken cancellationToken)
  {
    var observed = new List<ObservedSmtcSession>();

    foreach (var session in monitor.Sessions)
    {
      cancellationToken.ThrowIfCancellationRequested();

      try
      {
        if (!PotPlayerIdentity.IsSourceAppId(
          session.SourceAppUserModelId))
        {
          continue;
        }

        var properties = await session.GetMediaPropertiesAsync(
          cancellationToken);
        if (properties is not null)
          observed.Add(new ObservedSmtcSession(session, properties));
      }
      catch (Exception exception) when (IsExpectedFailure(exception))
      {
      }
    }

    return observed;
  }

  private PlayerSessionMatch MatchLaunch(
    PlayerLaunchResult launch,
    IReadOnlyList<ObservedSmtcSession> sessions,
    DateTimeOffset now,
    bool titleIsAmbiguous)
  {
    if (!processLifetime.IsAlive(launch))
    {
      return CreateMatch(
        launch,
        PlayerSessionMatchState.ProcessExited,
        null,
        now);
    }

    if (titleIsAmbiguous)
    {
      return CreateMatch(
        launch,
        PlayerSessionMatchState.Ambiguous,
        null,
        now);
    }

    var candidates = sessions
      .Where(item => PlayerSessionTitle.Matches(
        item.Properties.Title,
        launch.SessionTitle))
      .ToArray();
    if (candidates.Length == 1)
    {
      return CreateMatch(
        launch,
        PlayerSessionMatchState.Matched,
        candidates[0].Session,
        now);
    }

    if (candidates.Length > 1)
    {
      return CreateMatch(
        launch,
        PlayerSessionMatchState.Ambiguous,
        null,
        now);
    }

    var state = now - launch.StartedAt <= matchWindow
      ? PlayerSessionMatchState.Awaiting
      : PlayerSessionMatchState.TimedOut;
    return CreateMatch(launch, state, null, now);
  }

  private static PlayerSessionMatch CreateMatch(
    PlayerLaunchResult launch,
    PlayerSessionMatchState state,
    ISmtcSession? session,
    DateTimeOffset updatedAt)
  {
    return new PlayerSessionMatch(
      launch.PlaySessionId,
      launch.ProcessId,
      launch.StartedAt,
      state,
      session,
      updatedAt);
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
        if (HasLaunches())
          await RefreshSafelyAsync(cancellationToken);
      }
    }
    catch (OperationCanceledException) when (
      cancellationToken.IsCancellationRequested)
    {
    }
  }

  private bool HasLaunches()
  {
    lock (sync)
      return launches.Count > 0;
  }

  private void OnMonitorChanged(
    object? sender,
    SmtcSessionEventArgs args)
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

  private static bool HasSameMatches(
    PlayerSessionMatcherSnapshot first,
    PlayerSessionMatcherSnapshot second)
  {
    return first.Matches.Count == second.Matches.Count
      && first.Matches.Zip(second.Matches).All(pair =>
        pair.First.PlaySessionId == pair.Second.PlaySessionId
        && pair.First.State == pair.Second.State
        && ReferenceEquals(pair.First.Session, pair.Second.Session));
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

  private sealed record ObservedSmtcSession(
    ISmtcSession Session,
    SmtcMediaProperties Properties);
}

internal sealed class WindowsPlayerProcessLifetime
  : IPlayerProcessLifetime
{
  private static readonly TimeSpan StartTimeTolerance =
    TimeSpan.FromSeconds(10);

  public bool IsAlive(PlayerLaunchResult launch)
  {
    try
    {
      using var process = Process.GetProcessById(launch.ProcessId);
      if (process.HasExited)
        return false;

      var processStart = new DateTimeOffset(
        process.StartTime.ToUniversalTime());
      return (processStart - launch.StartedAt).Duration()
        <= StartTimeTolerance;
    }
    catch (Exception exception) when (
      exception is ArgumentException
        or InvalidOperationException
        or Win32Exception
        or NotSupportedException)
    {
      return false;
    }
  }
}
