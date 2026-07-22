using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using NewEmby.PlayerBridge.Pairing;
using NewEmby.PlayerBridge.Players;
using NewEmby.PlayerBridge.Security;

namespace NewEmby.PlayerBridge.Status;

internal static class BridgeStatusEndpoint
{
  public static void Map(
    WebApplication application,
    IBridgeCredentialStore credentialStore,
    BridgeRequestSecurity security,
    IPlayerDiscovery playerDiscovery)
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
      var response = BridgeStatusResponse.Create(
        requestedVersion,
        credentialStore.Read() is not null,
        players);

      await context.Response.WriteAsJsonAsync(response);
    });
  }
}
