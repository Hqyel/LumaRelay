using System.ComponentModel;
using System.Diagnostics;

namespace LumaRelay.PlayerBridge.Players;

internal sealed class PotPlayerLauncher : IPlayerAdapter
{
  private readonly int bridgePort;
  private readonly IPlayerDiscovery discovery;
  private readonly IPlayerLaunchTracker? launchTracker;
  private readonly IPlayerProcessStarter processStarter;
  private readonly TimeProvider timeProvider;

  public PotPlayerLauncher(
    int bridgePort,
    IPlayerDiscovery discovery,
    IPlayerProcessStarter? processStarter = null,
    TimeProvider? timeProvider = null,
    IPlayerLaunchTracker? launchTracker = null)
  {
    this.bridgePort = bridgePort;
    this.discovery = discovery;
    this.processStarter = processStarter ?? new WindowsPlayerProcessStarter();
    this.timeProvider = timeProvider ?? TimeProvider.System;
    this.launchTracker = launchTracker;
  }

  public string AdapterId => PotPlayerIdentity.AdapterId;
  public string DisplayName => PotPlayerIdentity.DisplayName;

  public PlayerLaunchResult Launch(PlayerLaunchRequest request)
  {
    var players = discovery.Discover();
    if (players.Count == 0)
    {
      throw new PlayerLaunchException(
        PlayerLaunchFailure.PlayerNotFound,
        "PotPlayer is not installed.");
    }

    var player = players[0];
    var startInfo = PotPlayerCommandBuilder.Build(
      player,
      request,
      bridgePort);

    try
    {
      var processId = processStarter.Start(startInfo);
      var result = new PlayerLaunchResult(
        processId,
        request.PlaySessionId,
        timeProvider.GetUtcNow(),
        PlayerSessionTitle.Normalize(request.DisplayTitle));
      launchTracker?.Track(result);
      return result;
    }
    catch (Exception exception) when (
      exception is Win32Exception
        or InvalidOperationException
        or IOException
        or UnauthorizedAccessException)
    {
      throw new PlayerLaunchException(
        PlayerLaunchFailure.StartFailed,
        "PotPlayer could not be started.",
        exception);
    }
  }
}

internal sealed class WindowsPlayerProcessStarter : IPlayerProcessStarter
{
  public int Start(ProcessStartInfo startInfo)
  {
    using var process = Process.Start(startInfo);
    if (process is null)
    {
      throw new InvalidOperationException(
        "The player process was not created.");
    }

    return process.Id;
  }
}
