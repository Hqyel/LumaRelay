using System.Net;
using System.Text.Json;
using NewEmby.PlayerBridge.MediaSessions;
using NewEmby.PlayerBridge.Pairing;
using NewEmby.PlayerBridge.Playback;
using NewEmby.PlayerBridge.Security;

namespace NewEmby.PlayerBridge.Tests;

public sealed class GatewayPlaybackEventClientTests
{
  [Fact]
  public async Task RetriesSameSequenceThenAdvancesInOrder()
  {
    var handler = new RecordingHandler();
    using var httpClient = new HttpClient(handler);
    var client = new GatewayPlaybackEventClient(
      httpClient,
      new StoredCredentialStore(),
      TimeSpan.FromMilliseconds(5));
    var snapshot = CreateSnapshot();

    await client.SendPlayingAsync(snapshot, CancellationToken.None);
    await client.SendProgressAsync(
      snapshot with { PositionTicks = 20_000_000 },
      "timeUpdate",
      null,
      CancellationToken.None);

    Assert.Equal([1L, 1L, 2L], handler.Sequences);
    Assert.Equal(handler.Payloads[0], handler.Payloads[1]);
    Assert.Equal(3, handler.Nonces.Distinct(StringComparer.Ordinal).Count());
  }

  private static PlayerPlaybackSnapshot CreateSnapshot()
  {
    var now = DateTimeOffset.UtcNow;
    return new PlayerPlaybackSnapshot(
      Guid.Parse("11111111-1111-4111-8111-111111111111"),
      PlayerPlaybackState.Playing,
      10_000_000,
      600_000_000,
      0,
      600_000_000,
      now,
      now,
      1,
      false,
      false);
  }

  private sealed class RecordingHandler : HttpMessageHandler
  {
    private int requests;

    public List<string> Nonces { get; } = [];

    public List<string> Payloads { get; } = [];

    public List<long> Sequences { get; } = [];

    protected override async Task<HttpResponseMessage> SendAsync(
      HttpRequestMessage request,
      CancellationToken cancellationToken)
    {
      var payload = await request.Content!.ReadAsStringAsync(
        cancellationToken);
      using var document = JsonDocument.Parse(payload);
      Payloads.Add(payload);
      Sequences.Add(document.RootElement.GetProperty("sequence").GetInt64());
      Nonces.Add(request.Headers.GetValues(
        BridgeDeviceAuthentication.NonceHeaderName).Single());
      requests++;

      return new HttpResponseMessage(
        requests == 1
          ? HttpStatusCode.ServiceUnavailable
          : HttpStatusCode.OK);
    }
  }

  private sealed class StoredCredentialStore : IBridgeCredentialStore
  {
    private static readonly BridgeCredential Credential = new(
      "https://newemby.example.com",
      "11111111-1111-4111-8111-111111111111",
      new string('A', 43),
      ["https://newemby.example.com"]);

    public void Delete()
    {
    }

    public BridgeCredential? Read()
    {
      return Credential;
    }

    public void Save(BridgeCredential credential)
    {
    }
  }
}
