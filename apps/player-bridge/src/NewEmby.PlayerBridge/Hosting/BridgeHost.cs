using System.Net;
using System.Net.Sockets;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using NewEmby.PlayerBridge.MediaSessions;
using NewEmby.PlayerBridge.Status;
using NewEmby.PlayerBridge.Pairing;
using NewEmby.PlayerBridge.Players;
using NewEmby.PlayerBridge.Security;

namespace NewEmby.PlayerBridge.Hosting;

internal static class BridgeHost
{
  public static WebApplication Build(
    string[] args,
    IBridgeCredentialStore? credentialStore = null,
    BridgeNonceStore? nonceStore = null,
    IPlayerDiscovery? playerDiscovery = null,
    ISystemMediaSessionMonitor? smtcMonitor = null)
  {
    var builder = WebApplication.CreateSlimBuilder(args);
    var serverOptions = BridgeServerOptions.FromConfiguration(
      builder.Configuration);

    builder.WebHost.UseSetting(WebHostDefaults.ServerUrlsKey, string.Empty);
    builder.WebHost.ConfigureKestrel(options =>
      ConfigureListeners(options, serverOptions.Port));

    var mediaSessionMonitor = smtcMonitor
      ?? SystemMediaSessionMonitorFactory.Create();
    builder.Services.AddSingleton<ISystemMediaSessionMonitor>(
      mediaSessionMonitor);
    builder.Services.AddHostedService<SmtcMonitorHostedService>();

    var application = builder.Build();

    var credentials = credentialStore ?? new WindowsCredentialStore();
    var security = new BridgeRequestSecurity(
      credentials,
      nonceStore ?? new BridgeNonceStore());
    BridgeStatusEndpoint.Map(
      application,
      credentials,
      security,
      playerDiscovery ?? new PotPlayerDiscovery(),
      mediaSessionMonitor);
    BridgeSecurityEndpoint.Map(application, security, credentials);
    return application;
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
