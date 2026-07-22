using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Text;
using NewEmby.PlayerBridge.Hosting;
using NewEmby.PlayerBridge.Pairing;
using NewEmby.PlayerBridge.Players;
using NewEmby.PlayerBridge.Security;

namespace NewEmby.PlayerBridge.Tests;

public sealed class LocalPlaybackEndpointTests
{
  private const string AllowedOrigin = "https://newemby.example.com";
  private const string DeviceId =
    "11111111-1111-4111-8111-111111111111";
  private const string PlaySessionId =
    "22222222-2222-4222-8222-222222222222";

  [Fact]
  public async Task RedeemsLaunchesAndProxiesRangedMedia()
  {
    var port = ReserveLoopbackPort();
    var gateway = new GatewayHandler();
    using var gatewayClient = new HttpClient(gateway);
    var player = new RecordingPlayer();
    await using var application = BridgeHost.Build(
      ["--bridge-port", port.ToString(CultureInfo.InvariantCulture)],
      new StoredCredentialStore(),
      playerDiscovery: new EmptyPlayerDiscovery(),
      gatewayHttpClient: gatewayClient,
      playerAdapter: player);
    await application.StartAsync();
    using var localClient = new HttpClient(
      new SocketsHttpHandler { UseProxy = false })
    {
      BaseAddress = new Uri($"http://127.0.0.1:{port}"),
    };
    using var start = new HttpRequestMessage(HttpMethod.Post, "/v1/playback/start")
    {
      Content = JsonContent.Create(new { playTicket = Ticket() }),
    };
    start.Headers.Add("Origin", AllowedOrigin);
    start.Headers.Add("X-NewEmby-Nonce", "N".PadRight(43, 'N'));

    using var startResponse = await localClient.SendAsync(start);
    using var mediaRequest = new HttpRequestMessage(
      HttpMethod.Get,
      $"/v1/playback/{PlaySessionId}/media");
    mediaRequest.Headers.Range = new System.Net.Http.Headers.RangeHeaderValue(
      100,
      null);
    using var mediaResponse = await localClient.SendAsync(mediaRequest);

    Assert.Equal(HttpStatusCode.OK, startResponse.StatusCode);
    Assert.NotNull(player.Request);
    Assert.Equal(600_000_000, player.Request.ResumeTicks);
    Assert.Equal(
      $"http://127.0.0.1:{port}/v1/playback/{PlaySessionId}/media",
      player.Request.MediaUri.AbsoluteUri);
    Assert.Equal(HttpStatusCode.PartialContent, mediaResponse.StatusCode);
    Assert.Equal("media-bytes", await mediaResponse.Content.ReadAsStringAsync());
    Assert.Equal("bytes=100-", gateway.Range);
    Assert.Equal(2, gateway.Nonces.Distinct(StringComparer.Ordinal).Count());
    await application.StopAsync();
  }

  private static string Ticket()
  {
    return "pt1.33333333-3333-4333-8333-333333333333."
      + new string('C', 43);
  }

  private sealed class GatewayHandler : HttpMessageHandler
  {
    public List<string> Nonces { get; } = [];
    public string? Range { get; private set; }

    protected override Task<HttpResponseMessage> SendAsync(
      HttpRequestMessage request,
      CancellationToken cancellationToken)
    {
      Nonces.Add(request.Headers.GetValues(
        BridgeDeviceAuthentication.NonceHeaderName).Single());
      if (request.RequestUri!.AbsolutePath.EndsWith(
          "/play-tickets/redeem",
          StringComparison.Ordinal))
      {
        return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
          Content = JsonContent.Create(new
          {
            playSessionId = PlaySessionId,
            selection = new
            {
              audioStreamIndex = 1,
              itemId = "item-1",
              mediaSourceId = "source-1",
              resumeTicks = 600_000_000,
              subtitleStreamIndex = (int?)null,
            },
          }),
        });
      }

      Range = request.Headers.Range?.ToString();
      return Task.FromResult(new HttpResponseMessage(
        HttpStatusCode.PartialContent)
      {
        Content = new StringContent(
          "media-bytes",
          Encoding.UTF8,
          "application/octet-stream"),
      });
    }
  }

  private sealed class RecordingPlayer : IPlayerAdapter
  {
    public string AdapterId => "potplayer";
    public string DisplayName => "PotPlayer";
    public PlayerLaunchRequest? Request { get; private set; }

    public PlayerLaunchResult Launch(PlayerLaunchRequest request)
    {
      Request = request;
      return new PlayerLaunchResult(
        123,
        request.PlaySessionId,
        DateTimeOffset.UtcNow);
    }
  }

  private sealed class EmptyPlayerDiscovery : IPlayerDiscovery
  {
    public IReadOnlyList<DiscoveredPlayer> Discover() => [];
  }

  private sealed class StoredCredentialStore : IBridgeCredentialStore
  {
    private static readonly BridgeCredential Credential = new(
      "https://gateway.example.com",
      DeviceId,
      new string('B', 43),
      [AllowedOrigin]);

    public void Delete()
    {
    }

    public BridgeCredential? Read() => Credential;

    public void Save(BridgeCredential credential)
    {
    }
  }

  private static int ReserveLoopbackPort()
  {
    var listener = new TcpListener(IPAddress.Loopback, 0);
    try
    {
      listener.Start();
      return ((IPEndPoint)listener.LocalEndpoint).Port;
    }
    finally
    {
      listener.Stop();
    }
  }
}
