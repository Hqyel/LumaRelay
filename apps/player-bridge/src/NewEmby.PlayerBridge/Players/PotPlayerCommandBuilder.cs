using System.Diagnostics;
using System.Globalization;
using System.Net;

namespace NewEmby.PlayerBridge.Players;

internal static class PotPlayerCommandBuilder
{
  private const long MaximumPlaybackTicks = 9_007_199_254_740_991;

  private static readonly HashSet<string> ExecutableNames = new(
    StringComparer.OrdinalIgnoreCase)
  {
    "PotPlayerMini64.exe",
    "PotPlayerMini.exe",
    "PotPlayer64.exe",
    "PotPlayer.exe",
  };

  public static ProcessStartInfo Build(
    DiscoveredPlayer player,
    PlayerLaunchRequest request,
    int bridgePort)
  {
    ValidateExecutablePath(player.ExecutablePath);
    ValidatePort(bridgePort);
    ValidateTicks(request.ResumeTicks);
    ValidateDisplayTitle(request.DisplayTitle);
    if (request.PlaySessionId == Guid.Empty)
      throw InvalidRequest("The playback session ID is invalid.");

    ValidatePlaybackUri(
      request.MediaUri,
      bridgePort,
      request.PlaySessionId,
      "media");
    if (request.SubtitleUri is not null)
    {
      ValidatePlaybackUri(
        request.SubtitleUri,
        bridgePort,
        request.PlaySessionId,
        "subtitle");
    }

    var startInfo = new ProcessStartInfo
    {
      CreateNoWindow = true,
      FileName = player.ExecutablePath,
      UseShellExecute = false,
      WorkingDirectory = Path.GetDirectoryName(player.ExecutablePath)
        ?? throw InvalidRequest("The PotPlayer directory is invalid."),
    };
    startInfo.ArgumentList.Add("/new");
    if (request.ResumeTicks > 0)
    {
      startInfo.ArgumentList.Add(
        $"/seek={FormatSeekPosition(request.ResumeTicks)}");
    }

    startInfo.ArgumentList.Add(
      $"/title={PlayerSessionTitle.Normalize(request.DisplayTitle)}");
    if (request.SubtitleUri is not null)
      startInfo.ArgumentList.Add($"/sub={request.SubtitleUri.AbsoluteUri}");

    startInfo.ArgumentList.Add(request.MediaUri.AbsoluteUri);
    return startInfo;
  }

  private static void ValidateExecutablePath(string path)
  {
    if (string.IsNullOrWhiteSpace(path)
      || !Path.IsPathFullyQualified(path)
      || !ExecutableNames.Contains(Path.GetFileName(path)))
    {
      throw InvalidRequest("The PotPlayer executable path is invalid.");
    }
  }

  private static void ValidatePort(int port)
  {
    if (port is < 1024 or > 65535)
      throw InvalidRequest("The Bridge playback port is invalid.");
  }

  private static void ValidateTicks(long ticks)
  {
    if (ticks is < 0 or > MaximumPlaybackTicks)
      throw InvalidRequest("The resume position is invalid.");
  }

  private static void ValidateDisplayTitle(string value)
  {
    if (string.IsNullOrWhiteSpace(value)
      || value.Length > 256
      || value.Any(char.IsControl))
    {
      throw InvalidRequest("The player display title is invalid.");
    }
  }

  private static void ValidatePlaybackUri(
    Uri uri,
    int bridgePort,
    Guid playSessionId,
    string resource)
  {
    if (!uri.IsAbsoluteUri
      || !string.Equals(uri.Scheme, Uri.UriSchemeHttp,
        StringComparison.OrdinalIgnoreCase)
      || uri.Port != bridgePort
      || !string.IsNullOrEmpty(uri.UserInfo)
      || !string.IsNullOrEmpty(uri.Query)
      || !string.IsNullOrEmpty(uri.Fragment)
      || !IsLiteralLoopback(uri.Host))
    {
      throw InvalidRequest("The Bridge playback URI is invalid.");
    }

    var expectedPath = string.Create(
      CultureInfo.InvariantCulture,
      $"/v1/playback/{playSessionId:D}/{resource}");
    if (!string.Equals(
      uri.AbsolutePath,
      expectedPath,
      StringComparison.Ordinal))
    {
      throw InvalidRequest("The Bridge playback URI path is invalid.");
    }
  }

  private static bool IsLiteralLoopback(string host)
  {
    if (!IPAddress.TryParse(host.Trim('[', ']'), out var address))
      return false;

    return address.Equals(IPAddress.Loopback)
      || address.Equals(IPAddress.IPv6Loopback);
  }

  private static string FormatSeekPosition(long ticks)
  {
    var totalMilliseconds = ticks / TimeSpan.TicksPerMillisecond;
    var hours = totalMilliseconds / 3_600_000;
    var minutes = (totalMilliseconds / 60_000) % 60;
    var seconds = (totalMilliseconds / 1_000) % 60;
    var milliseconds = totalMilliseconds % 1_000;

    return string.Create(
      CultureInfo.InvariantCulture,
      $"{hours:D2}:{minutes:D2}:{seconds:D2}.{milliseconds:D3}");
  }

  private static PlayerLaunchException InvalidRequest(string message)
  {
    return new PlayerLaunchException(
      PlayerLaunchFailure.InvalidRequest,
      message);
  }
}
