namespace LumaRelay.PlayerBridge.Players;

public interface IPlayerAdapter
{
  string AdapterId { get; }
  string DisplayName { get; }
  PlayerLaunchResult Launch(PlayerLaunchRequest request);
}

internal static class PotPlayerIdentity
{
  private static readonly HashSet<string> SourceApplicationIds = new(
    StringComparer.OrdinalIgnoreCase)
  {
    "PotPlayerMini64",
    "PotPlayerMini",
    "PotPlayer64",
    "PotPlayer",
  };

  public const string AdapterId = "potplayer";
  public const string DisplayName = "PotPlayer";

  public static bool IsSourceAppId(string? value)
  {
    if (string.IsNullOrWhiteSpace(value))
      return false;

    var candidate = value.Trim();
    if (candidate.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
      candidate = candidate[..^4];

    var separator = candidate.LastIndexOfAny(['\\', '/', '!', '.']);
    if (separator >= 0)
      candidate = candidate[(separator + 1)..];

    return SourceApplicationIds.Contains(candidate);
  }
}
