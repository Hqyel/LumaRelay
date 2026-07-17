using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using NewEmby.PlayerBridge.Pairing;
using NewEmby.PlayerBridge.Security;

namespace NewEmby.PlayerBridge.Status;

internal static class BridgeStatusEndpoint
{
  public static void Map(
    WebApplication application,
    IBridgeCredentialStore credentialStore,
    BridgeRequestSecurity security)
  {
    application.MapGet("/v1/status", async (HttpContext context) =>
    {
      context.Response.Headers.CacheControl = "no-store";
      if (!await security.AuthorizeReadAsync(context))
        return;

      var requestedVersion = context.Request.Query["apiVersion"].ToString();
      var response = BridgeStatusResponse.Create(
        requestedVersion,
        credentialStore.Read() is not null);

      await context.Response.WriteAsJsonAsync(response);
    });
  }
}
