using System.Net.Http.Json;
using System.Text.Json;
using NewEmby.PlayerBridge.Pairing;
using NewEmby.PlayerBridge.Security;

namespace NewEmby.PlayerBridge.Playback;

internal sealed class GatewayPlayTicketClient(
  HttpClient httpClient,
  IBridgeCredentialStore credentialStore)
{
  public async Task<LocalPlaybackSession> RedeemAsync(
    string playTicket,
    CancellationToken cancellationToken)
  {
    var credential = credentialStore.Read()
      ?? throw new InvalidOperationException("The Bridge is not paired.");
    var endpoint = new Uri(
      new Uri(credential.GatewayBaseUrl),
      $"/api/v1/bridge/devices/{credential.DeviceId}/play-tickets/redeem");
    using var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
    {
      Content = JsonContent.Create(new { playTicket }),
    };
    BridgeDeviceAuthentication.Apply(
      request,
      credential,
      BridgeDeviceAuthentication.CreateNonce());
    using var response = await httpClient.SendAsync(
      request,
      cancellationToken);
    if (!response.IsSuccessStatusCode)
    {
      throw new InvalidOperationException(
        $"Gateway rejected the PlayTicket with HTTP "
        + $"{(int)response.StatusCode}.");
    }

    var payload = await response.Content.ReadFromJsonAsync<RedeemResponse>(
      cancellationToken: cancellationToken)
      ?? throw new JsonException(
        "Gateway returned an empty PlayTicket response.");
    if (!Guid.TryParse(payload.PlaySessionId, out var playSessionId)
        || string.IsNullOrWhiteSpace(payload.Selection?.ItemId)
        || string.IsNullOrWhiteSpace(payload.Selection.MediaSourceId)
        || payload.Selection.ResumeTicks < 0)
    {
      throw new JsonException(
        "Gateway returned an invalid PlayTicket response.");
    }

    return new LocalPlaybackSession(
      playSessionId,
      new LocalPlaybackSelection(
        payload.Selection.ItemId,
        payload.Selection.MediaSourceId,
        payload.Selection.ResumeTicks,
        payload.Selection.AudioStreamIndex,
        payload.Selection.SubtitleStreamIndex),
      DateTimeOffset.UtcNow);
  }

  private sealed record RedeemResponse(
    string PlaySessionId,
    RedeemSelection Selection);

  private sealed record RedeemSelection(
    string ItemId,
    string MediaSourceId,
    long ResumeTicks,
    int? AudioStreamIndex,
    int? SubtitleStreamIndex);
}
