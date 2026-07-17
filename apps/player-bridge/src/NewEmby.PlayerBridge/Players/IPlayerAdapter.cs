namespace NewEmby.PlayerBridge.Players;

public interface IPlayerAdapter
{
  string AdapterId { get; }
  string DisplayName { get; }
}
