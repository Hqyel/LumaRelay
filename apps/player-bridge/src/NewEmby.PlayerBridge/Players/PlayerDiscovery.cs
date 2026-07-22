namespace NewEmby.PlayerBridge.Players;

internal sealed record DiscoveredPlayer(
  string AdapterId,
  string DisplayName,
  string Version,
  string Architecture,
  bool IsRunning,
  string ExecutablePath);

internal interface IPlayerDiscovery
{
  IReadOnlyList<DiscoveredPlayer> Discover();
}

internal sealed record PlayerPathCandidate(
  string Path,
  bool IsRunning,
  int Priority);

internal interface IPotPlayerEnvironment
{
  IReadOnlyList<PlayerPathCandidate> GetCandidates();
  bool FileExists(string path);
  string? ReadFileVersion(string path);
}
