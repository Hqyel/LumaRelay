using System.Net;
using System.Text;
using NewEmby.PlayerBridge.Pairing;

namespace NewEmby.PlayerBridge.Tests;

public sealed class BridgePairingClientTests
{
  private const string PairingCode =
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  private const string DeviceCredential =
    "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

  [Fact]
  public async Task ExchangesCodeAndSavesOnlyTheDeviceCredential()
  {
    var handler = new StubHandler(HttpStatusCode.OK, $$"""
      {
        "allowedOrigins": ["https://newemby.example.com"],
        "device": {
          "deviceId": "11111111-1111-4111-8111-111111111111"
        },
        "deviceCredential": "{{DeviceCredential}}",
        "requestId": "request-1"
      }
      """);
    using var client = new HttpClient(handler);
    var store = new MemoryCredentialStore();
    var pairing = new BridgePairingClient(client, store);
    var request = BridgePairingRequest.Create(
      "https://gateway.example.com",
      PairingCode);

    await pairing.PairAsync(request, "Living Room PC");

    Assert.Equal(
      "https://gateway.example.com/",
      handler.RequestUri?.ToString());
    Assert.Equal(
      "/api/v1/bridge/pairings/redeem",
      handler.RequestPath);
    Assert.Contains(PairingCode, handler.RequestBody);
    Assert.DoesNotContain(DeviceCredential, handler.RequestBody);
    Assert.NotNull(store.Credential);
    Assert.Equal(DeviceCredential, store.Credential.DeviceCredential);
    Assert.Equal(
      ["https://newemby.example.com"],
      store.Credential.AllowedOrigins);
  }

  [Fact]
  public async Task DoesNotPersistFailedPairingResponse()
  {
    var handler = new StubHandler(
      HttpStatusCode.Unauthorized,
      "{\"error\":{\"code\":\"PAIRING_CODE_INVALID\"}}");
    using var client = new HttpClient(handler);
    var store = new MemoryCredentialStore();
    var pairing = new BridgePairingClient(client, store);
    var request = BridgePairingRequest.Create(
      "https://gateway.example.com",
      PairingCode);

    var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
      pairing.PairAsync(request, "Living Room PC"));

    Assert.Contains("HTTP 401", error.Message);
    Assert.DoesNotContain(PairingCode, error.Message);
    Assert.Null(store.Credential);
  }

  private sealed class MemoryCredentialStore : IBridgeCredentialStore
  {
    public BridgeCredential? Credential { get; private set; }

    public void Delete()
    {
      Credential = null;
    }

    public BridgeCredential? Read()
    {
      return Credential;
    }

    public void Save(BridgeCredential credential)
    {
      Credential = credential;
    }
  }

  private sealed class StubHandler(
    HttpStatusCode statusCode,
    string responseBody) : HttpMessageHandler
  {
    public string RequestBody { get; private set; } = string.Empty;

    public string? RequestPath { get; private set; }

    public Uri? RequestUri { get; private set; }

    protected override async Task<HttpResponseMessage> SendAsync(
      HttpRequestMessage request,
      CancellationToken cancellationToken)
    {
      RequestUri = new Uri(request.RequestUri!.GetLeftPart(UriPartial.Authority));
      RequestPath = request.RequestUri.AbsolutePath;
      RequestBody = await request.Content!.ReadAsStringAsync(
        cancellationToken);
      return new HttpResponseMessage(statusCode)
      {
        Content = new StringContent(
          responseBody,
          Encoding.UTF8,
          "application/json"),
      };
    }
  }
}
