using System.Globalization;
using System.Net;
using System.Net.Sockets;
using NewEmby.PlayerBridge.Hosting;
using NewEmby.PlayerBridge.Pairing;

namespace NewEmby.PlayerBridge.Tests;

public sealed class BridgeSecurityEndpointTests
{
  private const string AllowedOrigin = "https://newemby.example.com";
  private const string Nonce =
    "NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN";

  [Fact]
  public async Task AllowsExactOriginAndRejectsDifferentOrigin()
  {
    var (application, client) = await StartBridgeAsync();
    await using (application)
    using (client)
    {
      using var allowedRequest = new HttpRequestMessage(
        HttpMethod.Get,
        "/v1/status");
      allowedRequest.Headers.Add("Origin", AllowedOrigin);
      using var allowed = await client.SendAsync(allowedRequest);
      using var blockedRequest = new HttpRequestMessage(
        HttpMethod.Get,
        "/v1/status");
      blockedRequest.Headers.Add("Origin", "https://attacker.example.com");
      using var blocked = await client.SendAsync(blockedRequest);

      Assert.Equal(HttpStatusCode.OK, allowed.StatusCode);
      Assert.Equal(
        AllowedOrigin,
        allowed.Headers.GetValues("Access-Control-Allow-Origin").Single());
      Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);
      Assert.False(blocked.Headers.Contains("Access-Control-Allow-Origin"));
    }
  }

  [Fact]
  public async Task RequiresFreshNonceForStateChanges()
  {
    var (application, client) = await StartBridgeAsync();
    await using (application)
    using (client)
    {
      using var first = await SendVerificationAsync(client, Nonce);
      using var replay = await SendVerificationAsync(client, Nonce);
      using var invalid = await SendVerificationAsync(client, "short");

      Assert.Equal(HttpStatusCode.OK, first.StatusCode);
      Assert.Equal(HttpStatusCode.Conflict, replay.StatusCode);
      Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
    }
  }

  [Fact]
  public async Task HandlesAllowedPrivateNetworkPreflight()
  {
    var (application, client) = await StartBridgeAsync();
    await using (application)
    using (client)
    {
      using var request = new HttpRequestMessage(
        HttpMethod.Options,
        "/v1/pairing/verify");
      request.Headers.Add("Origin", AllowedOrigin);
      request.Headers.Add("Access-Control-Request-Method", "POST");
      request.Headers.Add(
        "Access-Control-Request-Private-Network",
        "true");
      using var response = await client.SendAsync(request);

      Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
      Assert.Equal(
        "true",
        response.Headers
          .GetValues("Access-Control-Allow-Private-Network")
          .Single());
    }
  }

  [Fact]
  public async Task ClearsLocalCredentialThroughProtectedEndpoint()
  {
    var port = ReserveLoopbackPort();
    var store = new MutableCredentialStore();
    await using var application = BridgeHost.Build(
      ["--bridge-port", port.ToString(CultureInfo.InvariantCulture)],
      store);
    await application.StartAsync();
    using var handler = new SocketsHttpHandler { UseProxy = false };
    using var client = new HttpClient(handler)
    {
      BaseAddress = new Uri($"http://127.0.0.1:{port}"),
    };
    using var request = new HttpRequestMessage(
      HttpMethod.Delete,
      "/v1/pairing");
    request.Headers.Add("Origin", AllowedOrigin);
    request.Headers.Add("X-NewEmby-Nonce", Nonce);

    using var response = await client.SendAsync(request);

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    Assert.Null(store.Read());
    await application.StopAsync();
  }

  private static async Task<HttpResponseMessage> SendVerificationAsync(
    HttpClient client,
    string nonce)
  {
    using var request = new HttpRequestMessage(
      HttpMethod.Post,
      "/v1/pairing/verify");
    request.Headers.Add("Origin", AllowedOrigin);
    request.Headers.Add("X-NewEmby-Nonce", nonce);
    return await client.SendAsync(request);
  }

  private static async Task<(
    Microsoft.AspNetCore.Builder.WebApplication Application,
    HttpClient Client)> StartBridgeAsync()
  {
    var port = ReserveLoopbackPort();
    var application = BridgeHost.Build(
      ["--bridge-port", port.ToString(CultureInfo.InvariantCulture)],
      new StoredCredentialStore());
    await application.StartAsync();
    var handler = new SocketsHttpHandler { UseProxy = false };
    var client = new HttpClient(handler)
    {
      BaseAddress = new Uri($"http://127.0.0.1:{port}"),
    };
    return (application, client);
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

  private sealed class StoredCredentialStore : IBridgeCredentialStore
  {
    private static readonly BridgeCredential Credential = new(
      "https://gateway.example.com",
      "11111111-1111-4111-8111-111111111111",
      "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      [AllowedOrigin]);

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

  private sealed class MutableCredentialStore : IBridgeCredentialStore
  {
    private BridgeCredential? credential = new(
      "https://gateway.example.com",
      "11111111-1111-4111-8111-111111111111",
      "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      [AllowedOrigin]);

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
}
