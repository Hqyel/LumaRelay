using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using NewEmby.PlayerBridge.Hosting;
using NewEmby.PlayerBridge.Pairing;
using NewEmby.PlayerBridge.Players;
using NewEmby.PlayerBridge.Security;

namespace NewEmby.PlayerBridge.Playback;

internal static class LocalPlaybackEndpoint
{
  public static void Map(
    WebApplication application,
    BridgeRequestSecurity security,
    GatewayPlayTicketClient ticketClient,
    GatewayPlaybackStreamClient streamClient,
    LocalPlaybackSessionStore sessionStore,
    IPlayerAdapter player,
    int bridgePort)
  {
    application.MapPost("/v1/playback/start", async context =>
    {
      context.Response.Headers.CacheControl = "no-store";
      if (!await security.AuthorizeStateChangeAsync(context))
        return;

      StartRequest? request;
      try
      {
        request = await context.Request.ReadFromJsonAsync<StartRequest>(
          context.RequestAborted);
      }
      catch (Exception exception) when (exception is BadHttpRequestException
        or InvalidOperationException)
      {
        await WriteErrorAsync(
          context,
          400,
          "PLAY_TICKET_INVALID",
          "The local playback request is invalid.");
        return;
      }

      if (request is null || string.IsNullOrWhiteSpace(request.PlayTicket))
      {
        await WriteErrorAsync(
          context,
          400,
          "PLAY_TICKET_INVALID",
          "The local playback request is invalid.");
        return;
      }

      try
      {
        var session = await ticketClient.RedeemAsync(
          request.PlayTicket,
          context.RequestAborted);
        sessionStore.Add(session);
        try
        {
          var mediaUri = PlaybackUri(
            bridgePort,
            session.PlaySessionId,
            "media");
          var subtitleUri = session.Selection.SubtitleStreamIndex.HasValue
            ? PlaybackUri(bridgePort, session.PlaySessionId, "subtitle")
            : null;
          player.Launch(new PlayerLaunchRequest(
            mediaUri,
            session.Selection.ResumeTicks,
            session.PlaySessionId,
            subtitleUri));
        }
        catch
        {
          sessionStore.Remove(session.PlaySessionId);
          throw;
        }

        await context.Response.WriteAsJsonAsync(new
        {
          playSessionId = session.PlaySessionId,
          player = player.AdapterId,
          status = "launching",
        });
      }
      catch (PlayerLaunchException exception)
      {
        var status = exception.Failure is PlayerLaunchFailure.PlayerNotFound
          ? 409
          : 502;
        await WriteErrorAsync(
          context,
          status,
          exception.Failure is PlayerLaunchFailure.PlayerNotFound
            ? "PLAYER_NOT_FOUND"
            : "PLAYER_START_FAILED",
          exception.Message);
      }
      catch (Exception exception) when (exception is HttpRequestException
        or InvalidOperationException
        or JsonException)
      {
        await WriteErrorAsync(
          context,
          502,
          "PLAY_TICKET_REDEEM_FAILED",
          "The Bridge could not prepare local playback.");
      }
    });

    application.MapGet(
      "/v1/playback/{playSessionId:guid}/{resource}",
      async context =>
      {
        if (!string.IsNullOrEmpty(context.Request.Headers.Origin))
        {
          context.Response.StatusCode = 403;
          return;
        }
        var playSessionId = Guid.Parse(
          context.Request.RouteValues["playSessionId"]!.ToString()!);
        var resource = context.Request.RouteValues["resource"]?.ToString();
        if ((resource is not "media" and not "subtitle")
            || !sessionStore.TryGet(playSessionId, out var session)
            || (resource == "subtitle"
              && !session.Selection.SubtitleStreamIndex.HasValue))
        {
          context.Response.StatusCode = 404;
          return;
        }

        HttpResponseMessage upstream;
        try
        {
          upstream = await streamClient.OpenAsync(
            session,
            resource,
            context.Request.Headers.Range.ToString(),
            context.RequestAborted);
        }
        catch (HttpRequestException)
        {
          await WriteErrorAsync(
            context,
            502,
            "UPSTREAM_STREAM_FAILED",
            "The Bridge could not open the Gateway media stream.");
          return;
        }

        using (upstream)
        {
          context.Response.StatusCode = (int)upstream.StatusCode;
          CopyHeader(upstream.Content.Headers.ContentType, context);
          CopyHeader(upstream.Content.Headers.ContentLength, context);
          CopyHeader(upstream.Content.Headers.ContentRange, context);
          if (upstream.Headers.AcceptRanges.Count > 0)
            context.Response.Headers.AcceptRanges =
              string.Join(",", upstream.Headers.AcceptRanges);
          await upstream.Content.CopyToAsync(
            context.Response.Body,
            context.RequestAborted);
        }
      });
  }

  private static Uri PlaybackUri(
    int port,
    Guid playSessionId,
    string resource)
  {
    return new Uri(
      $"http://127.0.0.1:{port}/v1/playback/"
      + $"{playSessionId:D}/{resource}");
  }

  private static void CopyHeader(
    MediaTypeHeaderValue? value,
    HttpContext context)
  {
    if (value is not null)
      context.Response.ContentType = value.ToString();
  }

  private static void CopyHeader(long? value, HttpContext context)
  {
    if (value.HasValue)
      context.Response.ContentLength = value.Value;
  }

  private static void CopyHeader(
    ContentRangeHeaderValue? value,
    HttpContext context)
  {
    if (value is not null)
      context.Response.Headers.ContentRange = value.ToString();
  }

  private static async Task WriteErrorAsync(
    HttpContext context,
    int statusCode,
    string code,
    string message)
  {
    context.Response.StatusCode = statusCode;
    await context.Response.WriteAsJsonAsync(new
    {
      error = new { code, message },
    });
  }

  private sealed record StartRequest(string PlayTicket);
}

internal sealed class GatewayPlaybackStreamClient(
  HttpClient httpClient,
  IBridgeCredentialStore credentialStore)
{
  public async Task<HttpResponseMessage> OpenAsync(
    LocalPlaybackSession session,
    string resource,
    string? range,
    CancellationToken cancellationToken)
  {
    var credential = credentialStore.Read()
      ?? throw new InvalidOperationException("The Bridge is not paired.");
    var endpoint = new Uri(
      new Uri(credential.GatewayBaseUrl),
      $"/api/v1/bridge/devices/{credential.DeviceId}/playback/"
      + $"{session.PlaySessionId:D}/{resource}");
    using var request = new HttpRequestMessage(HttpMethod.Get, endpoint);
    if (!string.IsNullOrWhiteSpace(range))
      request.Headers.TryAddWithoutValidation("Range", range);
    BridgeDeviceAuthentication.Apply(
      request,
      credential,
      BridgeDeviceAuthentication.CreateNonce());
    var response = await httpClient.SendAsync(
      request,
      HttpCompletionOption.ResponseHeadersRead,
      cancellationToken);
    if (!response.IsSuccessStatusCode)
    {
      response.Dispose();
      throw new HttpRequestException(
        $"Gateway rejected the playback stream with HTTP "
        + $"{(int)response.StatusCode}.");
    }

    return response;
  }
}
