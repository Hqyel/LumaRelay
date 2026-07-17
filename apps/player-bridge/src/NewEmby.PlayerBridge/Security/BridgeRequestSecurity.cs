using Microsoft.AspNetCore.Http;
using NewEmby.PlayerBridge.Pairing;

namespace NewEmby.PlayerBridge.Security;

internal sealed class BridgeRequestSecurity(
  IBridgeCredentialStore credentialStore,
  BridgeNonceStore nonceStore)
{
  private const string NonceHeaderName = "X-NewEmby-Nonce";

  public async Task<bool> AuthorizeReadAsync(HttpContext context)
  {
    var origin = context.Request.Headers.Origin.ToString();
    if (string.IsNullOrEmpty(origin))
      return true;

    return await AuthorizeOriginAsync(context, origin);
  }

  public async Task<bool> AuthorizeStateChangeAsync(HttpContext context)
  {
    var origin = context.Request.Headers.Origin.ToString();
    if (string.IsNullOrEmpty(origin))
    {
      await WriteErrorAsync(
        context,
        StatusCodes.Status403Forbidden,
        "ORIGIN_NOT_ALLOWED",
        "The request origin is missing or not allowed.");
      return false;
    }

    if (!await AuthorizeOriginAsync(context, origin))
      return false;

    var nonce = context.Request.Headers[NonceHeaderName].ToString();
    var result = nonceStore.TryUse(nonce);
    if (result is NonceUseResult.Accepted)
      return true;

    await WriteErrorAsync(
      context,
      result is NonceUseResult.Replay
        ? StatusCodes.Status409Conflict
        : StatusCodes.Status400BadRequest,
      result is NonceUseResult.Replay
        ? "REPLAY_DETECTED"
        : "NONCE_INVALID",
      result is NonceUseResult.Replay
        ? "The request nonce has already been used."
        : "The request nonce is missing or invalid.");
    return false;
  }

  public async Task HandlePreflightAsync(HttpContext context)
  {
    var origin = context.Request.Headers.Origin.ToString();
    if (string.IsNullOrEmpty(origin))
    {
      await WriteErrorAsync(
        context,
        StatusCodes.Status403Forbidden,
        "ORIGIN_NOT_ALLOWED",
        "The request origin is missing or not allowed.");
      return;
    }

    if (!await AuthorizeOriginAsync(context, origin))
      return;

    context.Response.Headers.AccessControlAllowMethods =
      "GET, POST, OPTIONS";
    context.Response.Headers.AccessControlAllowHeaders =
      $"Content-Type, {NonceHeaderName}";
    if (string.Equals(
          context.Request.Headers["Access-Control-Request-Private-Network"],
          "true",
          StringComparison.OrdinalIgnoreCase))
    {
      context.Response.Headers["Access-Control-Allow-Private-Network"] =
        "true";
    }

    context.Response.StatusCode = StatusCodes.Status204NoContent;
  }

  private async Task<bool> AuthorizeOriginAsync(
    HttpContext context,
    string origin)
  {
    var credential = credentialStore.Read();
    if (credential is null)
    {
      await WriteErrorAsync(
        context,
        StatusCodes.Status401Unauthorized,
        "PAIRING_REQUIRED",
        "Pair the Bridge before using it from a browser.");
      return false;
    }

    if (!credential.AllowedOrigins.Contains(
          origin,
          StringComparer.Ordinal))
    {
      await WriteErrorAsync(
        context,
        StatusCodes.Status403Forbidden,
        "ORIGIN_NOT_ALLOWED",
        "The request origin is not allowed.");
      return false;
    }

    context.Response.Headers.AccessControlAllowOrigin = origin;
    context.Response.Headers.Append("Vary", "Origin");
    return true;
  }

  private static async Task WriteErrorAsync(
    HttpContext context,
    int statusCode,
    string code,
    string message)
  {
    context.Response.StatusCode = statusCode;
    context.Response.Headers.CacheControl = "no-store";
    await context.Response.WriteAsJsonAsync(new
    {
      error = new { code, message },
    });
  }
}
