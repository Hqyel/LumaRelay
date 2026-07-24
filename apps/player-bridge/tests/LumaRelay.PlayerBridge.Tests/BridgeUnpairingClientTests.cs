using System.Net;
using LumaRelay.PlayerBridge.Pairing;

namespace LumaRelay.PlayerBridge.Tests;

public sealed class BridgeUnpairingClientTests
{
  [Theory]
  [InlineData(HttpStatusCode.OK)]
  [InlineData(HttpStatusCode.Unauthorized)]
  public async Task ClearsLocalCredentialAfterRemoteRevocation(
    HttpStatusCode statusCode)
  {
    var handler = new StubHandler(statusCode);
    using var client = new HttpClient(handler);
    var store = new MemoryCredentialStore();
    var unpairing = new BridgeUnpairingClient(client, store);

    await unpairing.UnpairAsync();

    Assert.Null(store.Read());
    Assert.Equal(HttpMethod.Delete, handler.Method);
    Assert.Equal(
      "/api/v1/bridge/devices/11111111-1111-4111-8111-111111111111/credential",
      handler.RequestUri?.AbsolutePath);
    Assert.Equal(
      "LumaRelayDevice",
      handler.AuthorizationScheme);
    Assert.Equal(43, handler.Nonce?.Length);
  }

  [Fact]
  public async Task RetainsCredentialWhenGatewayRevocationFails()
  {
    var handler = new StubHandler(HttpStatusCode.ServiceUnavailable);
    using var client = new HttpClient(handler);
    var store = new MemoryCredentialStore();
    var unpairing = new BridgeUnpairingClient(client, store);

    await Assert.ThrowsAsync<InvalidOperationException>(
      () => unpairing.UnpairAsync());

    Assert.NotNull(store.Read());
  }

  private sealed class MemoryCredentialStore : IBridgeCredentialStore
  {
    private BridgeCredential? credential = new(
      "https://gateway.example.com",
      "11111111-1111-4111-8111-111111111111",
      "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      ["https://lumarelay.example.com"]);

    public void Delete()
    {
      credential = null;
    }

    public BridgeCredential? Read()
    {
      return credential;
    }

    public void Save(BridgeCredential value)
    {
      credential = value;
    }
  }

  private sealed class StubHandler(HttpStatusCode statusCode)
    : HttpMessageHandler
  {
    public string? AuthorizationScheme { get; private set; }

    public HttpMethod? Method { get; private set; }

    public string? Nonce { get; private set; }

    public Uri? RequestUri { get; private set; }

    protected override Task<HttpResponseMessage> SendAsync(
      HttpRequestMessage request,
      CancellationToken cancellationToken)
    {
      AuthorizationScheme = request.Headers.Authorization?.Scheme;
      Method = request.Method;
      Nonce = request.Headers
        .GetValues("X-LumaRelay-Nonce")
        .Single();
      RequestUri = request.RequestUri;
      return Task.FromResult(new HttpResponseMessage(statusCode));
    }
  }
}
