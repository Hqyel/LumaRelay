namespace NewEmby.PlayerBridge.Players;

internal sealed class PotPlayerDiscovery : IPlayerDiscovery, IPlayerAdapter
{
  private static readonly HashSet<string> ExecutableNames = new(
    StringComparer.OrdinalIgnoreCase)
  {
    "PotPlayerMini64.exe",
    "PotPlayerMini.exe",
    "PotPlayer64.exe",
    "PotPlayer.exe",
  };

  private readonly IPotPlayerEnvironment environment;

  public PotPlayerDiscovery(IPotPlayerEnvironment? environment = null)
  {
    this.environment = environment ?? new WindowsPotPlayerEnvironment();
  }

  public string AdapterId => "potplayer";
  public string DisplayName => "PotPlayer";

  public IReadOnlyList<DiscoveredPlayer> Discover()
  {
    var installations = new Dictionary<string, Installation>(
      StringComparer.OrdinalIgnoreCase);

    foreach (var candidate in environment.GetCandidates())
    {
      var path = ValidatePath(candidate.Path);
      if (path is null)
        continue;

      if (installations.TryGetValue(path, out var current))
      {
        installations[path] = current with
        {
          IsRunning = current.IsRunning || candidate.IsRunning,
          Priority = Math.Min(current.Priority, candidate.Priority),
        };
        continue;
      }

      installations[path] = new Installation(
        path,
        candidate.IsRunning,
        candidate.Priority);
    }

    return installations.Values
      .OrderByDescending(installation => installation.IsRunning)
      .ThenByDescending(installation =>
        GetArchitecture(installation.Path) == "x64")
      .ThenBy(installation => installation.Priority)
      .ThenBy(installation => installation.Path,
        StringComparer.OrdinalIgnoreCase)
      .Select(CreateSummary)
      .Take(1)
      .ToArray();
  }

  private DiscoveredPlayer CreateSummary(Installation installation)
  {
    var architecture = GetArchitecture(installation.Path);
    var version = ReadVersion(installation.Path, architecture) ?? "unknown";

    return new DiscoveredPlayer(
      AdapterId,
      DisplayName,
      version,
      architecture,
      installation.IsRunning,
      installation.Path);
  }

  private string? ValidatePath(string candidate)
  {
    if (string.IsNullOrWhiteSpace(candidate))
      return null;

    try
    {
      var unquoted = candidate.Trim().Trim('"');
      if (!Path.IsPathFullyQualified(unquoted))
        return null;

      var path = Path.GetFullPath(unquoted);
      if (!ExecutableNames.Contains(Path.GetFileName(path)))
        return null;

      return environment.FileExists(path) ? path : null;
    }
    catch (Exception exception) when (
      exception is ArgumentException
        or NotSupportedException
        or PathTooLongException)
    {
      return null;
    }
  }

  private string? ReadVersion(string executablePath, string architecture)
  {
    var version = NormalizeVersion(
      environment.ReadFileVersion(executablePath));
    if (version is not null && !IsZeroVersion(version))
      return version;

    var directory = Path.GetDirectoryName(executablePath);
    if (directory is null)
      return null;

    var coreName = architecture == "x64"
      ? "PotPlayer64.dll"
      : "PotPlayer.dll";
    var corePath = Path.Combine(directory, coreName);
    if (!environment.FileExists(corePath))
      return null;

    version = NormalizeVersion(environment.ReadFileVersion(corePath));
    return version is not null && !IsZeroVersion(version) ? version : null;
  }

  private static string GetArchitecture(string path)
  {
    return Path.GetFileNameWithoutExtension(path)
      .EndsWith("64", StringComparison.OrdinalIgnoreCase)
      ? "x64"
      : "x86";
  }

  private static string? NormalizeVersion(string? value)
  {
    if (string.IsNullOrWhiteSpace(value))
      return null;

    var components = value
      .Replace(',', '.')
      .Split('.', StringSplitOptions.TrimEntries);
    if (components.Length is < 2 or > 4)
      return null;

    var normalized = new int[components.Length];
    for (var i = 0; i < components.Length; i++)
    {
      if (!int.TryParse(components[i], out normalized[i])
        || normalized[i] < 0)
      {
        return null;
      }
    }

    return string.Join('.', normalized);
  }

  private static bool IsZeroVersion(string version)
  {
    return version
      .Split('.')
      .All(component => component == "0");
  }

  private sealed record Installation(
    string Path,
    bool IsRunning,
    int Priority);
}
