using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

namespace NewEmby.PlayerBridge.Security;

internal static class BridgeSecurityEndpoint
{
  public static void Map(
    WebApplication application,
    BridgeRequestSecurity security)
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
  }
}
