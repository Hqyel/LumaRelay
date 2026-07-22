using NewEmby.PlayerBridge.Players;

namespace NewEmby.PlayerBridge.Tests;

public sealed class PotPlayerDiscoveryTests
{
  [Fact]
  public void DiscoversDeduplicatesAndOrdersInstallations()
  {
    var environment = new FakePotPlayerEnvironment();
    var x64Path = @"C:\Program Files\DAUM\PotPlayer\PotPlayerMini64.exe";
    var x86Path = @"C:\Tools\PotPlayer\PotPlayerMini.exe";
    environment.AddFile(x64Path, "0, 0, 0, 0");
    environment.AddFile(
      @"C:\Program Files\DAUM\PotPlayer\PotPlayer64.dll",
      "1, 7, 22398, 0");
    environment.AddFile(x86Path, "1.7.22222.0");
    environment.Candidates.AddRange(
    [
      new PlayerPathCandidate($"\"{x64Path}\"", false, 20),
      new PlayerPathCandidate(x64Path, true, 0),
      new PlayerPathCandidate(x86Path, false, 10),
    ]);

    var players = new PotPlayerDiscovery(environment).Discover();

    var player = Assert.Single(players);
    Assert.Equal("potplayer", player.AdapterId);
    Assert.Equal("PotPlayer", player.DisplayName);
    Assert.Equal("1.7.22398.0", player.Version);
    Assert.Equal("x64", player.Architecture);
    Assert.True(player.IsRunning);
    Assert.Equal(Path.GetFullPath(x64Path), player.ExecutablePath);
  }

  [Fact]
  public void RejectsMissingRelativeAndUnsupportedExecutables()
  {
    var environment = new FakePotPlayerEnvironment();
    var unsupported = @"C:\Tools\PotPlayer\helper.exe";
    environment.AddFile(unsupported, "1.0.0.0");
    environment.Candidates.AddRange(
    [
      new PlayerPathCandidate("PotPlayerMini64.exe", false, 0),
      new PlayerPathCandidate(unsupported, false, 0),
      new PlayerPathCandidate(
        @"C:\Missing\PotPlayerMini64.exe",
        false,
        0),
    ]);

    var players = new PotPlayerDiscovery(environment).Discover();

    Assert.Empty(players);
  }

  [Fact]
  public void ReportsUnknownWhenNoUsableVersionExists()
  {
    var environment = new FakePotPlayerEnvironment();
    var path = @"C:\Tools\PotPlayer\PotPlayerMini64.exe";
    environment.AddFile(path, "not-a-version");
    environment.Candidates.Add(new PlayerPathCandidate(path, false, 0));

    var player = Assert.Single(
      new PotPlayerDiscovery(environment).Discover());

    Assert.Equal("unknown", player.Version);
  }

  [Fact]
  public void DiscoversAValid32BitInstallation()
  {
    var environment = new FakePotPlayerEnvironment();
    var path = @"C:\Tools\PotPlayer\PotPlayerMini.exe";
    environment.AddFile(path, "1.7.22222.0");
    environment.Candidates.Add(new PlayerPathCandidate(path, false, 20));

    var player = Assert.Single(
      new PotPlayerDiscovery(environment).Discover());

    Assert.Equal("x86", player.Architecture);
    Assert.Equal("1.7.22222.0", player.Version);
  }

  [Fact]
  public void ReturnsEmptyOutsideWindowsEnvironment()
  {
    var players = new PotPlayerDiscovery(
      new FakePotPlayerEnvironment()).Discover();

    Assert.Empty(players);
  }

  private sealed class FakePotPlayerEnvironment : IPotPlayerEnvironment
  {
    private readonly Dictionary<string, string?> versions = new(
      StringComparer.OrdinalIgnoreCase);

    public List<PlayerPathCandidate> Candidates { get; } = [];

    public IReadOnlyList<PlayerPathCandidate> GetCandidates()
    {
      return Candidates;
    }

    public bool FileExists(string path)
    {
      return versions.ContainsKey(path);
    }

    public string? ReadFileVersion(string path)
    {
      return versions.GetValueOrDefault(path);
    }

    public void AddFile(string path, string? version)
    {
      versions[Path.GetFullPath(path)] = version;
    }
  }
}
