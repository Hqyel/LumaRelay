using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using LumaRelay.PlayerBridge.Pairing;

namespace LumaRelay.PlayerBridge.Security;

internal static class BridgeSecurityEndpoint
{
  public static void Map(
    WebApplication application,
    BridgeRequestSecurity security,
    IBridgeCredentialStore credentialStore)
  {
    application.MapMethods(
      "/v1/{**path}",
      [HttpMethods.Options],
      security.HandlePreflightAsync);
    application.MapPost("/v1/pairing/verify", async context =>
    {
      context.Response.Headers.CacheControl = "no-store";
      if (!await security.AuthorizeStateChangeAsync(context))
        return;

      await context.Response.WriteAsJsonAsync(new { status = "ok" });
    });
    application.MapDelete("/v1/pairing", async context =>
    {
      context.Response.Headers.CacheControl = "no-store";
      if (!await security.AuthorizeStateChangeAsync(context))
        return;

      credentialStore.Delete();
      await context.Response.WriteAsJsonAsync(new { success = true });
    });
  }
}
