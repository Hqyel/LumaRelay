using System.Globalization;
using System.Net;
using System.Net.Sockets;
using LumaRelay.PlayerBridge.Hosting;

namespace LumaRelay.PlayerBridge.Tests;

public sealed class BridgeHostTests
{
  [Fact]
  public async Task ListensOnLoopbackWithoutServerDisclosure()
  {
    var (port, injectedPort) = ReserveLoopbackPorts();
    var arguments = new[]
    {
      "--bridge-port",
      port.ToString(CultureInfo.InvariantCulture),
      "--urls",
      $"http://0.0.0.0:{injectedPort}",
      "--Kestrel:Endpoints:Injected:Url",
      $"http://0.0.0.0:{injectedPort}",
    };
    await using var application = BridgeHost.Build(arguments);

    await application.StartAsync();

    using var handler = new SocketsHttpHandler { UseProxy = false };
    using var client = new HttpClient(handler);
    foreach (var address in BridgeHost.GetLoopbackAddresses())
    {
      var uri = new UriBuilder("http", address.ToString(), port).Uri;
      using var response = await client.GetAsync(uri);

      Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
      Assert.False(response.Headers.Contains("Server"));
    }

    var injectedUri = new UriBuilder(
      "http",
      IPAddress.Loopback.ToString(),
      injectedPort).Uri;
    await Assert.ThrowsAnyAsync<HttpRequestException>(() =>
      client.GetAsync(injectedUri));

    await application.StopAsync();
  }

  private static (int BridgePort, int InjectedPort) ReserveLoopbackPorts()
  {
    var bridgeListener = new TcpListener(IPAddress.Loopback, 0);
    var injectedListener = new TcpListener(IPAddress.Loopback, 0);

    try
    {
      bridgeListener.Start();
      injectedListener.Start();

      var bridgePort = ((IPEndPoint)bridgeListener.LocalEndpoint).Port;
      var injectedPort = ((IPEndPoint)injectedListener.LocalEndpoint).Port;

      return (bridgePort, injectedPort);
    }
    finally
    {
      bridgeListener.Stop();
      injectedListener.Stop();
    }
  }
}
