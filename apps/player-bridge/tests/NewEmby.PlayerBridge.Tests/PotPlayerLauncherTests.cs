using System.ComponentModel;
using System.Diagnostics;
using NewEmby.PlayerBridge.Players;

namespace NewEmby.PlayerBridge.Tests;

public sealed class PotPlayerLauncherTests
{
  private static readonly Guid PlaySessionId = Guid.Parse(
    "22222222-2222-4222-8222-222222222222");
  private static readonly DateTimeOffset StartedAt = new(
    2026,
    7,
    22,
    8,
    0,
    0,
    TimeSpan.Zero);

  [Fact]
  public void StartsDiscoveredPotPlayerAndReturnsProcessIdentity()
  {
    var processStarter = new RecordingProcessStarter(4242);
    var launchTracker = new RecordingLaunchTracker();
    var launcher = new PotPlayerLauncher(
      58080,
      new InstalledPlayerDiscovery(),
      processStarter,
      new FixedTimeProvider(StartedAt),
      launchTracker);
    var request = CreateRequest();

    var result = launcher.Launch(request);

    Assert.IsAssignableFrom<IPlayerAdapter>(launcher);
    Assert.Equal("potplayer", launcher.AdapterId);
    Assert.Equal("PotPlayer", launcher.DisplayName);
    Assert.Equal(4242, result.ProcessId);
    Assert.Equal(PlaySessionId, result.PlaySessionId);
    Assert.Equal(StartedAt, result.StartedAt);
    Assert.Equal("示例电影", result.SessionTitle);
    Assert.Equal(result, launchTracker.Result);
    Assert.NotNull(processStarter.StartInfo);
    Assert.False(processStarter.StartInfo.UseShellExecute);
    Assert.Equal(
      request.MediaUri.AbsoluteUri,
      processStarter.StartInfo.ArgumentList[^1]);
  }

  [Fact]
  public void FailsClearlyWhenPotPlayerIsNotInstalled()
  {
    var launcher = new PotPlayerLauncher(
      58080,
      new EmptyPlayerDiscovery(),
      new RecordingProcessStarter(1));

    var exception = Assert.Throws<PlayerLaunchException>(() =>
      launcher.Launch(CreateRequest()));

    Assert.Equal(PlayerLaunchFailure.PlayerNotFound, exception.Failure);
  }

  [Fact]
  public void HidesOperatingSystemDetailsWhenProcessStartFails()
  {
    var launcher = new PotPlayerLauncher(
      58080,
      new InstalledPlayerDiscovery(),
      new FailingProcessStarter());

    var exception = Assert.Throws<PlayerLaunchException>(() =>
      launcher.Launch(CreateRequest()));

    Assert.Equal(PlayerLaunchFailure.StartFailed, exception.Failure);
    Assert.Equal("PotPlayer could not be started.", exception.Message);
    Assert.IsType<Win32Exception>(exception.InnerException);
  }

  private static PlayerLaunchRequest CreateRequest()
  {
    return new PlayerLaunchRequest(
      new Uri(
        "http://127.0.0.1:58080/v1/playback/"
          + "22222222-2222-4222-8222-222222222222/media"),
      0,
      PlaySessionId,
      null,
      "示例电影");
  }

  private sealed class EmptyPlayerDiscovery : IPlayerDiscovery
  {
    public IReadOnlyList<DiscoveredPlayer> Discover()
    {
      return [];
    }
  }

  private sealed class InstalledPlayerDiscovery : IPlayerDiscovery
  {
    public IReadOnlyList<DiscoveredPlayer> Discover()
    {
      return
      [
        new DiscoveredPlayer(
          "potplayer",
          "PotPlayer",
          "1.7.22398.0",
          "x64",
          false,
          @"C:\Program Files\DAUM\PotPlayer\PotPlayerMini64.exe"),
      ];
    }
  }

  private sealed class RecordingProcessStarter : IPlayerProcessStarter
  {
    private readonly int processId;

    public RecordingProcessStarter(int processId)
    {
      this.processId = processId;
    }

    public ProcessStartInfo? StartInfo { get; private set; }

    public int Start(ProcessStartInfo startInfo)
    {
      StartInfo = startInfo;
      return processId;
    }
  }

  private sealed class FailingProcessStarter : IPlayerProcessStarter
  {
    public int Start(ProcessStartInfo startInfo)
    {
      throw new Win32Exception(5, "sensitive operating system detail");
    }
  }

  private sealed class RecordingLaunchTracker : IPlayerLaunchTracker
  {
    public PlayerLaunchResult? Result { get; private set; }

    public void Track(PlayerLaunchResult result)
    {
      Result = result;
    }
  }

  private sealed class FixedTimeProvider : TimeProvider
  {
    private readonly DateTimeOffset value;

    public FixedTimeProvider(DateTimeOffset value)
    {
      this.value = value;
    }

    public override DateTimeOffset GetUtcNow()
    {
      return value;
    }
  }
}
