using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

namespace NewEmby.PlayerBridge.Status;

internal static class BridgeStatusEndpoint
{
  public static void Map(WebApplication application)
  {
    application.MapGet("/v1/status", (HttpContext context) =>
    {
      context.Response.Headers.CacheControl = "no-store";

      var requestedVersion = context.Request.Query["apiVersion"].ToString();
      var response = BridgeStatusResponse.Create(requestedVersion);

      return Results.Json(response);
    });
  }
}
