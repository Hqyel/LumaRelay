namespace LumaRelay.PlayerBridge.Protocol;

internal static class ProtocolRegistration
{
  internal const string CommandKey = ProtocolKey + @"\shell\open\command";
  internal const string DefaultIconKey = ProtocolKey + @"\DefaultIcon";
  internal const string ProtocolKey = @"Software\Classes\lumarelay";

  public static void Register(
    string executablePath,
    IProtocolRegistry registry)
  {
    ArgumentNullException.ThrowIfNull(registry);

    var normalizedPath = ValidateExecutablePath(executablePath);
    var quotedPath = $"\"{normalizedPath}\"";

    registry.WriteString(ProtocolKey, string.Empty, "URL:LumaRelay Protocol");
    registry.WriteString(ProtocolKey, "URL Protocol", string.Empty);
    registry.WriteString(DefaultIconKey, string.Empty, $"{quotedPath},0");
    registry.WriteString(
      CommandKey,
      string.Empty,
      $"{quotedPath} --protocol \"%1\"");
  }

  public static void Unregister(IProtocolRegistry registry)
  {
    ArgumentNullException.ThrowIfNull(registry);
    registry.DeleteTree(ProtocolKey);
  }

  private static string ValidateExecutablePath(string executablePath)
  {
    if (string.IsNullOrWhiteSpace(executablePath))
    {
      throw new ArgumentException(
        "Bridge executable path is required.",
        nameof(executablePath));
    }

    var normalizedPath = Path.GetFullPath(executablePath);
    if (normalizedPath.Contains('"'))
    {
      throw new ArgumentException(
        "Bridge executable path cannot contain quotes.",
        nameof(executablePath));
    }

    if (!string.Equals(
          Path.GetExtension(normalizedPath),
          ".exe",
          StringComparison.OrdinalIgnoreCase))
    {
      throw new ArgumentException(
        "Bridge executable path must end in .exe.",
        nameof(executablePath));
    }

    return normalizedPath;
  }
}
