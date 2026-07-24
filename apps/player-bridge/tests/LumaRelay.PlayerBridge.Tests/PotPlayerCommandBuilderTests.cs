using System.Diagnostics;
using LumaRelay.PlayerBridge.Players;

namespace LumaRelay.PlayerBridge.Tests;

public sealed class PotPlayerCommandBuilderTests
{
  private const int BridgePort = 58080;
  private static readonly Guid PlaySessionId = Guid.Parse(
    "22222222-2222-4222-8222-222222222222");
  private static readonly DiscoveredPlayer Player = new(
    "potplayer",
    "PotPlayer",
    "1.7.22398.0",
    "x64",
    false,
    @"C:\Program Files\DAUM\PotPlayer\PotPlayerMini64.exe");

  [Fact]
  public void BuildsSeparateArgumentsForResumeTitleAndSubtitle()
  {
    var resume = new TimeSpan(0, 1, 2, 3, 456).Ticks;
    var request = new PlayerLaunchRequest(
      PlaybackUri("media"),
      resume,
      PlaySessionId,
      PlaybackUri("subtitle", ipv6: true),
      "示例剧集-新的开始-第3/12集");

    var startInfo = PotPlayerCommandBuilder.Build(
      Player,
      request,
      BridgePort);

    Assert.Equal(Player.ExecutablePath, startInfo.FileName);
    Assert.Equal(
      Path.GetDirectoryName(Player.ExecutablePath),
      startInfo.WorkingDirectory);
    Assert.False(startInfo.UseShellExecute);
    Assert.True(startInfo.CreateNoWindow);
    Assert.Equal(
    [
      "/new",
      "/seek=01:02:03.456",
      "/title=示例剧集-新的开始-第3/12集",
      "/sub=http://[::1]:58080/v1/playback/"
        + "22222222-2222-4222-8222-222222222222/subtitle",
      "http://127.0.0.1:58080/v1/playback/"
        + "22222222-2222-4222-8222-222222222222/media",
    ],
      startInfo.ArgumentList);
    Assert.DoesNotContain(
      startInfo.ArgumentList,
      argument => argument.Contains(
        "/headers",
        StringComparison.OrdinalIgnoreCase));
  }

  [Fact]
  public void OmitsSeekAndSubtitleAtPlaybackStart()
  {
    var request = new PlayerLaunchRequest(
      PlaybackUri("media"),
      0,
      PlaySessionId,
      null,
      "示例电影");

    var startInfo = PotPlayerCommandBuilder.Build(
      Player,
      request,
      BridgePort);

    Assert.Equal(
    [
      "/new",
      "/title=示例电影",
      "http://127.0.0.1:58080/v1/playback/"
        + "22222222-2222-4222-8222-222222222222/media",
    ],
      startInfo.ArgumentList);
  }

  [Theory]
  [MemberData(nameof(InvalidRequests))]
  public void RejectsUnsafePlaybackInputs(
    string mediaUri,
    long resumeTicks,
    Guid playSessionId,
    string? subtitleUri)
  {
    var request = new PlayerLaunchRequest(
      new Uri(mediaUri),
      resumeTicks,
      playSessionId,
      subtitleUri is null ? null : new Uri(subtitleUri));
    var exception = Assert.Throws<PlayerLaunchException>(() =>
      PotPlayerCommandBuilder.Build(Player, request, BridgePort));

    Assert.Equal(PlayerLaunchFailure.InvalidRequest, exception.Failure);
  }

  [Fact]
  public void RejectsAnExecutableOutsideThePotPlayerBoundary()
  {
    var player = Player with { ExecutablePath = @"C:\Windows\cmd.exe" };
    var request = new PlayerLaunchRequest(
      PlaybackUri("media"),
      0,
      PlaySessionId,
      null);

    var exception = Assert.Throws<PlayerLaunchException>(() =>
      PotPlayerCommandBuilder.Build(player, request, BridgePort));

    Assert.Equal(PlayerLaunchFailure.InvalidRequest, exception.Failure);
  }

  [Theory]
  [InlineData(1023)]
  [InlineData(65536)]
  public void RejectsAPlaybackPortOutsideTheBridgeRange(int port)
  {
    var request = new PlayerLaunchRequest(
      PlaybackUri("media"),
      0,
      PlaySessionId,
      null);

    var exception = Assert.Throws<PlayerLaunchException>(() =>
      PotPlayerCommandBuilder.Build(Player, request, port));

    Assert.Equal(PlayerLaunchFailure.InvalidRequest, exception.Failure);
  }

  public static TheoryData<string, long, Guid, string?> InvalidRequests()
  {
    var validMedia = PlaybackUri("media").AbsoluteUri;
    return new TheoryData<string, long, Guid, string?>
    {
      { InvalidMediaUri("https://127.0.0.1:58080"), 0, PlaySessionId, null },
      { InvalidMediaUri("http://localhost:58080"), 0, PlaySessionId, null },
      { InvalidMediaUri("http://192.0.2.1:58080"), 0, PlaySessionId, null },
      { InvalidMediaUri("http://127.0.0.2:58080"), 0, PlaySessionId, null },
      { InvalidMediaUri("http://127.0.0.1:58081"), 0, PlaySessionId, null },
      {
        InvalidMediaUri("http://user@127.0.0.1:58080"),
        0,
        PlaySessionId,
        null
      },
      {
        InvalidMediaUri(
          "http://127.0.0.1:58080",
          "?api_key=secret"),
        0,
        PlaySessionId,
        null
      },
      {
        InvalidMediaUri("http://127.0.0.1:58080", "#fragment"),
        0,
        PlaySessionId,
        null
      },
      { validMedia, -1, PlaySessionId, null },
      { validMedia, 9_007_199_254_740_992, PlaySessionId, null },
      { validMedia, 0, Guid.Empty, null },
      { validMedia, 0, PlaySessionId, validMedia },
      {
        "http://127.0.0.1:58080/v1/playback/"
          + "33333333-3333-4333-8333-333333333333/media",
        0,
        PlaySessionId,
        null
      },
    };
  }

  private static string InvalidMediaUri(
    string origin,
    string suffix = "")
  {
    return $"{origin}/v1/playback/{PlaySessionId:D}/media{suffix}";
  }

  private static Uri PlaybackUri(string resource, bool ipv6 = false)
  {
    var host = ipv6 ? "[::1]" : "127.0.0.1";
    return new Uri(
      $"http://{host}:{BridgePort}/v1/playback/"
        + $"{PlaySessionId:D}/{resource}");
  }
}
