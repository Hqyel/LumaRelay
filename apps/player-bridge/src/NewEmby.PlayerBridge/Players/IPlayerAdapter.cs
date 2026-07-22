namespace NewEmby.PlayerBridge.Players;

public interface IPlayerAdapter
{
  string AdapterId { get; }
  string DisplayName { get; }
  PlayerLaunchResult Launch(PlayerLaunchRequest request);
}

internal static class PotPlayerIdentity
{
  public const string AdapterId = "potplayer";
  public const string DisplayName = "PotPlayer";
}
