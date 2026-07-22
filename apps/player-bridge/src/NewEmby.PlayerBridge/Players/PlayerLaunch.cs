using System.Diagnostics;

namespace NewEmby.PlayerBridge.Players;

public enum PlayerLaunchFailure
{
  InvalidRequest,
  PlayerNotFound,
  StartFailed,
}

public sealed class PlayerLaunchException : Exception
{
  public PlayerLaunchException(
    PlayerLaunchFailure failure,
    string message,
    Exception? innerException = null)
    : base(message, innerException)
  {
    Failure = failure;
  }

  public PlayerLaunchFailure Failure { get; }
}

public sealed record PlayerLaunchRequest(
  Uri MediaUri,
  long ResumeTicks,
  Guid PlaySessionId,
  Uri? SubtitleUri);

public sealed record PlayerLaunchResult(
  int ProcessId,
  Guid PlaySessionId,
  DateTimeOffset StartedAt);

internal interface IPlayerProcessStarter
{
  int Start(ProcessStartInfo startInfo);
}
