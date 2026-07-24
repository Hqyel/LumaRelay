using System.Net;
using System.Net.Sockets;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using LumaRelay.PlayerBridge.MediaSessions;
using LumaRelay.PlayerBridge.Status;
using LumaRelay.PlayerBridge.Pairing;
using LumaRelay.PlayerBridge.Playback;
using LumaRelay.PlayerBridge.Players;
using LumaRelay.PlayerBridge.Security;

namespace LumaRelay.PlayerBridge.Hosting;

internal static class BridgeHost
{
  public static WebApplication Build(
    string[] args,
    IBridgeCredentialStore? credentialStore = null,
    BridgeNonceStore? nonceStore = null,
    IPlayerDiscovery? playerDiscovery = null,
    ISystemMediaSessionMonitor? smtcMonitor = null,
    HttpClient? gatewayHttpClient = null,
    IPlayerAdapter? playerAdapter = null)
  {
    var builder = WebApplication.CreateSlimBuilder(args);
    var serverOptions = BridgeServerOptions.FromConfiguration(
      builder.Configuration);

    builder.WebHost.UseSetting(WebHostDefaults.ServerUrlsKey, string.Empty);
    builder.WebHost.ConfigureKestrel(options =>
      ConfigureListeners(options, serverOptions.Port));

    var mediaSessionMonitor = smtcMonitor
      ?? SystemMediaSessionMonitorFactory.Create();
    var credentials = credentialStore ?? new WindowsCredentialStore();
    var discovery = playerDiscovery ?? new PotPlayerDiscovery();
    var sessionMatcher = new PotPlayerSessionMatcher(mediaSessionMonitor);
    var playbackMonitor = new PotPlayerPlaybackMonitor(sessionMatcher);
    var gatewayClient = gatewayHttpClient
      ?? new HttpClient { Timeout = TimeSpan.FromSeconds(8) };
    var playbackSessions = new LocalPlaybackSessionStore();
    var player = playerAdapter
      ?? new PotPlayerLauncher(
        serverOptions.Port,
        discovery,
        launchTracker: sessionMatcher);
    builder.Services.AddSingleton<ISystemMediaSessionMonitor>(
      mediaSessionMonitor);
    builder.Services.AddHostedService<SmtcMonitorHostedService>();
    builder.Services.AddSingleton<IHostedService>(sessionMatcher);
    builder.Services.AddSingleton<IHostedService>(playbackMonitor);
    builder.Services.AddSingleton<IPlaybackEventClient>(
      new GatewayPlaybackEventClient(
        gatewayClient,
        credentials));
    builder.Services.AddSingleton(services => new PlaybackEventReporter(
      playbackMonitor,
      services.GetRequiredService<IPlaybackEventClient>()));
    builder.Services.AddSingleton<IPlaybackInteractionReporter>(services =>
      services.GetRequiredService<PlaybackEventReporter>());
    builder.Services.AddSingleton<IHostedService>(services =>
      services.GetRequiredService<PlaybackEventReporter>());
    builder.Services.AddSingleton<IPlayerAdapter>(player);

    var application = builder.Build();

    var security = new BridgeRequestSecurity(
      credentials,
      nonceStore ?? new BridgeNonceStore());
    BridgeStatusEndpoint.Map(
      application,
      credentials,
      security,
      discovery,
      mediaSessionMonitor);
    BridgeSecurityEndpoint.Map(application, security, credentials);
    LocalPlaybackEndpoint.Map(
      application,
      security,
      new GatewayPlayTicketClient(gatewayClient, credentials),
      new GatewayPlaybackStreamClient(gatewayClient, credentials),
      playbackSessions,
      player,
      serverOptions.Port);
    LocalPlaybackStatusEndpoint.Map(
      application,
      security,
      playbackSessions,
      sessionMatcher,
      playbackMonitor);
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
