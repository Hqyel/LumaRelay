using System.Net;
using System.Net.Sockets;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.Configuration;

namespace NewEmby.PlayerBridge.Hosting;

internal static class BridgeHost
{
  public static WebApplication Build(string[] args)
  {
    var builder = WebApplication.CreateSlimBuilder(args);
    var serverOptions = BridgeServerOptions.FromConfiguration(
      builder.Configuration);

    builder.WebHost.UseSetting(WebHostDefaults.ServerUrlsKey, string.Empty);
    builder.WebHost.ConfigureKestrel(options =>
      ConfigureListeners(options, serverOptions.Port));

    return builder.Build();
  }

  internal static IReadOnlyList<IPAddress> GetLoopbackAddresses()
  {
    if (Socket.OSSupportsIPv6)
      return [IPAddress.Loopback, IPAddress.IPv6Loopback];

    return [IPAddress.Loopback];
  }

  private static void ConfigureListeners(
    KestrelServerOptions options,
    int port)
  {
    var emptyConfiguration = new ConfigurationBuilder().Build();

    options.Configure(emptyConfiguration, reloadOnChange: false);
    options.AddServerHeader = false;

    foreach (var address in GetLoopbackAddresses())
    {
      options.Listen(address, port, endpoint =>
      {
        endpoint.Protocols = HttpProtocols.Http1;
      });
    }
  }
}
