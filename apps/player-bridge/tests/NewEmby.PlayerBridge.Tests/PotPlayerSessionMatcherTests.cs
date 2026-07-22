using NewEmby.PlayerBridge.MediaSessions;
using NewEmby.PlayerBridge.Players;

namespace NewEmby.PlayerBridge.Tests;

public sealed class PotPlayerSessionMatcherTests
{
  private static readonly DateTimeOffset StartedAt = new(
    2026,
    7,
    22,
    10,
    0,
    0,
    TimeSpan.Zero);
  private static readonly Guid FirstPlaySessionId = Guid.Parse(
    "11111111-1111-4111-8111-111111111111");
  private static readonly Guid SecondPlaySessionId = Guid.Parse(
    "22222222-2222-4222-8222-222222222222");

  [Fact]
  public async Task MatchesOnlyTheExactNewEmbyPotPlayerSession()
  {
    var expected = new FakeSession(
      "PotPlayerMini64.exe",
      PlayerSessionTitle.Create(FirstPlaySessionId));
    var monitor = new FakeMonitor(
    [
      new FakeSession(
        "browser.application",
        PlayerSessionTitle.Create(FirstPlaySessionId)),
      new FakeSession("PotPlayerMini64.exe", "unrelated media"),
      expected,
    ]);
    var matcher = CreateMatcher(monitor);
    matcher.Track(CreateLaunch(FirstPlaySessionId, 101));

    await matcher.RefreshAsync(CancellationToken.None);

    var match = Assert.Single(matcher.Snapshot.Matches);
    Assert.Equal(PlayerSessionMatchState.Matched, match.State);
    Assert.Same(expected, match.Session);
    Assert.True(matcher.TryGetMatchedSession(
      FirstPlaySessionId,
      out var session));
    Assert.Same(expected, session);

    matcher.Untrack(FirstPlaySessionId);

    Assert.Empty(matcher.Snapshot.Matches);
    Assert.False(matcher.TryGetMatchedSession(
      FirstPlaySessionId,
      out _));
  }

  [Theory]
  [InlineData("PotPlayerMini64.exe", true)]
  [InlineData(@"C:\Apps\PotPlayerMini.exe", true)]
  [InlineData("Daum.PotPlayer64", true)]
  [InlineData("other.PotPlayerHelper.exe", false)]
  [InlineData("browser.application", false)]
  public void RecognizesOnlySupportedPotPlayerSourceIds(
    string sourceAppId,
    bool expected)
  {
    Assert.Equal(
      expected,
      PotPlayerIdentity.IsSourceAppId(sourceAppId));
  }

  [Fact]
  public async Task KeepsDuplicateExactSessionsAmbiguous()
  {
    var title = PlayerSessionTitle.Create(FirstPlaySessionId);
    var monitor = new FakeMonitor(
    [
      new FakeSession("PotPlayerMini64.exe", title),
      new FakeSession("PotPlayerMini64.exe", title),
    ]);
    var matcher = CreateMatcher(monitor);
    matcher.Track(CreateLaunch(FirstPlaySessionId, 101));

    await matcher.RefreshAsync(CancellationToken.None);

    var match = Assert.Single(matcher.Snapshot.Matches);
    Assert.Equal(PlayerSessionMatchState.Ambiguous, match.State);
    Assert.Null(match.Session);
    Assert.False(matcher.TryGetMatchedSession(
      FirstPlaySessionId,
      out _));
  }

  [Fact]
  public async Task DoesNotGuessFromASolePotPlayerSession()
  {
    var timeProvider = new AdjustableTimeProvider(StartedAt);
    var monitor = new FakeMonitor(
    [
      new FakeSession("PotPlayerMini64.exe", "another title"),
    ]);
    var matcher = CreateMatcher(monitor, timeProvider: timeProvider);
    matcher.Track(CreateLaunch(FirstPlaySessionId, 101));

    await matcher.RefreshAsync(CancellationToken.None);
    Assert.Equal(
      PlayerSessionMatchState.Awaiting,
      Assert.Single(matcher.Snapshot.Matches).State);

    timeProvider.Advance(TimeSpan.FromSeconds(16));
    await matcher.RefreshAsync(CancellationToken.None);

    Assert.Equal(
      PlayerSessionMatchState.TimedOut,
      Assert.Single(matcher.Snapshot.Matches).State);
  }

  [Fact]
  public async Task RejectsAReusedOrExitedProcessIdentity()
  {
    var monitor = new FakeMonitor(
    [
      new FakeSession(
        "PotPlayerMini64.exe",
        PlayerSessionTitle.Create(FirstPlaySessionId)),
    ]);
    var matcher = CreateMatcher(
      monitor,
      new FakeProcessLifetime([]));
    matcher.Track(CreateLaunch(FirstPlaySessionId, 101));

    await matcher.RefreshAsync(CancellationToken.None);

    Assert.Equal(
      PlayerSessionMatchState.ProcessExited,
      Assert.Single(matcher.Snapshot.Matches).State);
  }

  [Fact]
  public async Task SeparatesMultipleNewEmbyPotPlayerInstances()
  {
    var first = new FakeSession(
      "PotPlayerMini64.exe",
      PlayerSessionTitle.Create(FirstPlaySessionId));
    var second = new FakeSession(
      "PotPlayerMini64.exe",
      PlayerSessionTitle.Create(SecondPlaySessionId));
    var matcher = CreateMatcher(new FakeMonitor([second, first]));
    matcher.Track(CreateLaunch(FirstPlaySessionId, 101));
    matcher.Track(CreateLaunch(SecondPlaySessionId, 202));

    await matcher.RefreshAsync(CancellationToken.None);

    Assert.Equal(2, matcher.Snapshot.Matches.Count);
    Assert.True(matcher.TryGetMatchedSession(
      FirstPlaySessionId,
      out var firstMatch));
    Assert.True(matcher.TryGetMatchedSession(
      SecondPlaySessionId,
      out var secondMatch));
    Assert.Same(first, firstMatch);
    Assert.Same(second, secondMatch);
  }

  [Fact]
  public async Task RechecksMediaPropertiesWhenSmtcRaisesAnEvent()
  {
    var session = new FakeSession("PotPlayerMini64.exe", "loading");
    var monitor = new FakeMonitor([session]);
    var matcher = CreateMatcher(monitor);
    await matcher.StartAsync(CancellationToken.None);
    matcher.Track(CreateLaunch(FirstPlaySessionId, 101));
    await matcher.RefreshAsync(CancellationToken.None);
    Assert.Equal(
      PlayerSessionMatchState.Awaiting,
      Assert.Single(matcher.Snapshot.Matches).State);

    var matched = new TaskCompletionSource(
      TaskCreationOptions.RunContinuationsAsynchronously);
    matcher.Changed += (_, _) =>
    {
      if (matcher.Snapshot.Matches.Any(item =>
        item.State == PlayerSessionMatchState.Matched))
      {
        matched.TrySetResult();
      }
    };
    session.Title = PlayerSessionTitle.Create(FirstPlaySessionId);
    monitor.RaiseChanged();

    await matched.Task.WaitAsync(TimeSpan.FromSeconds(2));
    Assert.True(matcher.TryGetMatchedSession(
      FirstPlaySessionId,
      out var result));
    Assert.Same(session, result);
    await matcher.StopAsync(CancellationToken.None);
  }

  private static PotPlayerSessionMatcher CreateMatcher(
    ISystemMediaSessionMonitor monitor,
    IPlayerProcessLifetime? processLifetime = null,
    TimeProvider? timeProvider = null)
  {
    return new PotPlayerSessionMatcher(
      monitor,
      processLifetime ?? new FakeProcessLifetime([101, 202]),
      timeProvider ?? new AdjustableTimeProvider(StartedAt),
      TimeSpan.FromSeconds(15));
  }

  private static PlayerLaunchResult CreateLaunch(
    Guid playSessionId,
    int processId)
  {
    return new PlayerLaunchResult(processId, playSessionId, StartedAt);
  }

  private sealed class FakeMonitor(
    IReadOnlyList<ISmtcSession> sessions) : ISystemMediaSessionMonitor
  {
    public event EventHandler<SmtcSessionEventArgs>? Changed;

    public SmtcMonitorSnapshot Snapshot { get; } = new(
      SmtcCapability.Ready,
      true,
      sessions.Count,
      sessions.Count(item => PotPlayerIdentity.IsSourceAppId(
        item.SourceAppUserModelId)));
    public IReadOnlyList<ISmtcSession> Sessions { get; } = sessions;

    public Task StartAsync(CancellationToken cancellationToken)
    {
      return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
      return Task.CompletedTask;
    }

    public void RaiseChanged()
    {
      Changed?.Invoke(
        this,
        new SmtcSessionEventArgs(
          SmtcSessionEventKind.MediaPropertiesChanged,
          "PotPlayerMini64.exe",
          Snapshot));
    }
  }

  private sealed class FakeSession(
    string sourceAppUserModelId,
    string title) : ISmtcSession
  {
    public event EventHandler? MediaPropertiesChanged
    {
      add { }
      remove { }
    }
    public event EventHandler? PlaybackInfoChanged
    {
      add { }
      remove { }
    }
    public event EventHandler? TimelinePropertiesChanged
    {
      add { }
      remove { }
    }

    public string SourceAppUserModelId { get; } = sourceAppUserModelId;
    public string Title { get; set; } = title;

    public Task<SmtcMediaProperties?> GetMediaPropertiesAsync(
      CancellationToken cancellationToken)
    {
      return Task.FromResult<SmtcMediaProperties?>(new(
        Title,
        string.Empty,
        string.Empty,
        string.Empty));
    }

    public void Dispose()
    {
    }
  }

  private sealed class FakeProcessLifetime(
    IReadOnlyCollection<int> runningProcessIds)
    : IPlayerProcessLifetime
  {
    public bool IsAlive(PlayerLaunchResult launch)
    {
      return runningProcessIds.Contains(launch.ProcessId);
    }
  }

  private sealed class AdjustableTimeProvider(DateTimeOffset value)
    : TimeProvider
  {
    private DateTimeOffset value = value;

    public override DateTimeOffset GetUtcNow()
    {
      return value;
    }

    public void Advance(TimeSpan amount)
    {
      value += amount;
    }
  }
}
