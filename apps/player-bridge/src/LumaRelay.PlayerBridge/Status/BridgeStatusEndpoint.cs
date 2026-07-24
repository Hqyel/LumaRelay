using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using LumaRelay.PlayerBridge.MediaSessions;
using LumaRelay.PlayerBridge.Pairing;
using LumaRelay.PlayerBridge.Players;
using LumaRelay.PlayerBridge.Security;

namespace LumaRelay.PlayerBridge.Status;

internal static class BridgeStatusEndpoint
{
  public static void Map(
    WebApplication application,
    IBridgeCredentialStore credentialStore,
    BridgeRequestSecurity security,
    IPlayerDiscovery playerDiscovery,
    ISystemMediaSessionMonitor smtcMonitor)
  {
    application.MapGet("/v1/status", async (HttpContext context) =>
    {
      context.Response.Headers.CacheControl = "no-store";
      if (!await security.AuthorizeReadAsync(context))
        return;

      var requestedVersion = context.Request.Query["apiVersion"].ToString();
      var players = playerDiscovery.Discover()
        .Select(player => new BridgePlayerStatus(
          player.AdapterId,
          player.DisplayName,
          true,
          player.Version,
          player.Architecture,
          player.IsRunning))
        .ToArray();
      var credential = credentialStore.Read();
      var response = BridgeStatusResponse.Create(
        requestedVersion,
        credential?.DeviceId,
        players,
        smtcMonitor.Snapshot);

      await context.Response.WriteAsJsonAsync(response);
    });
  }
}
