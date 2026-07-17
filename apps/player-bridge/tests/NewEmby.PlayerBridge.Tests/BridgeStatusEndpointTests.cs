using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Net.Sockets;
using NewEmby.PlayerBridge.Hosting;
using NewEmby.PlayerBridge.Status;

namespace NewEmby.PlayerBridge.Tests;

public sealed class BridgeStatusEndpointTests
{
  [Theory]
  [InlineData(null, true, null)]
  [InlineData("1", true, 1)]
  [InlineData("2", false, 2)]
  [InlineData("invalid", false, null)]
  public async Task ReturnsVersionCompatibility(
    string? requestedVersion,
    bool expectedCompatibility,
    int? expectedRequestedVersion)
  {
    var port = ReserveLoopbackPort();
    await using var application = BridgeHost.Build(
      ["--bridge-port", port.ToString(CultureInfo.InvariantCulture)]);
    await application.StartAsync();

    using var handler = new SocketsHttpHandler { UseProxy = false };
    using var client = new HttpClient(handler);
    var query = requestedVersion is null
      ? string.Empty
      : $"?apiVersion={requestedVersion}";
    var uri = $"http://127.0.0.1:{port}/v1/status{query}";
    using var response = await client.GetAsync(uri);
    var status = await response.Content
      .ReadFromJsonAsync<BridgeStatusResponse>();

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    Assert.Equal(
      "application/json",
      response.Content.Headers.ContentType?.MediaType);
    Assert.True(response.Headers.CacheControl?.NoStore);
    Assert.NotNull(status);
    Assert.Equal("NewEmby.PlayerBridge", status.ApplicationId);
    Assert.Equal("0.1.0", status.BridgeVersion);
    Assert.Equal(1, status.ApiVersion);
    Assert.Equal("ready", status.Status);
    Assert.Equal("windows", status.Platform);
    Assert.Equal("x64", status.Architecture);
    Assert.False(status.IsPaired);
    Assert.Empty(status.Players);
    Assert.Equal(expectedCompatibility, status.Compatibility.IsCompatible);
    Assert.Equal(
      expectedRequestedVersion,
      status.Compatibility.RequestedApiVersion);
    Assert.Equal(1, status.Compatibility.MinimumClientApiVersion);
    Assert.Equal(1, status.Compatibility.MaximumClientApiVersion);

    await application.StopAsync();
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
