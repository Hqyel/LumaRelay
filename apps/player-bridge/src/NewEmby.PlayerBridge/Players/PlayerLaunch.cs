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

internal interface IPlayerLaunchTracker
{
  void Track(PlayerLaunchResult result);
}

internal static class PlayerSessionTitle
{
  private const string Prefix = "NewEmby:";

  public static string Create(Guid playSessionId)
  {
    return $"{Prefix}{playSessionId:D}";
  }

  public static bool Matches(string? value, Guid playSessionId)
  {
    return string.Equals(
      value?.Trim(),
      Create(playSessionId),
      StringComparison.OrdinalIgnoreCase);
  }
}

internal interface IPlayerProcessStarter
{
  int Start(ProcessStartInfo startInfo);
}
