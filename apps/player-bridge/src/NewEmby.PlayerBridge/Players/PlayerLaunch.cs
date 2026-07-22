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
  Uri? SubtitleUri,
  string DisplayTitle = "NewEmby");

public sealed record PlayerLaunchResult(
  int ProcessId,
  Guid PlaySessionId,
  DateTimeOffset StartedAt,
  string SessionTitle = "NewEmby");

internal interface IPlayerLaunchTracker
{
  void Track(PlayerLaunchResult result);
}

internal static class PlayerSessionTitle
{
  public static string Normalize(string value)
  {
    return value.Trim();
  }

  public static bool Matches(string? value, string expected)
  {
    return string.Equals(
      value?.Trim(),
      expected,
      StringComparison.OrdinalIgnoreCase);
  }
}

internal interface IPlayerProcessStarter
{
  int Start(ProcessStartInfo startInfo);
}
