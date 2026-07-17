using System.Net.Http.Json;
using System.Text.Json;

namespace NewEmby.PlayerBridge.Pairing;

internal sealed class BridgePairingClient(
  HttpClient httpClient,
  IBridgeCredentialStore credentialStore)
{
  public async Task PairAsync(
    BridgePairingRequest request,
    string deviceName,
    CancellationToken cancellationToken = default)
  {
    ArgumentNullException.ThrowIfNull(request);

    var endpoint = new Uri(
      request.GatewayBaseUrl,
      "/api/v1/bridge/pairings/redeem");
    using var response = await httpClient.PostAsJsonAsync(
      endpoint,
      new RedeemRequest(
        BridgeVersion(),
        deviceName,
        request.PairingCode,
        "windows"),
      cancellationToken);
    if (!response.IsSuccessStatusCode)
    {
      throw new InvalidOperationException(
        $"Gateway rejected Bridge pairing with HTTP "
        + $"{(int)response.StatusCode}.");
    }

    var payload = await response.Content.ReadFromJsonAsync<RedeemResponse>(
      cancellationToken: cancellationToken);
    if (payload is null
        || payload.Device is null
        || string.IsNullOrWhiteSpace(payload.Device.DeviceId)
        || string.IsNullOrWhiteSpace(payload.DeviceCredential)
        || payload.DeviceCredential.Length != 43
        || payload.AllowedOrigins is null
        || payload.AllowedOrigins.Length == 0)
    {
      throw new JsonException("Gateway returned an invalid pairing response.");
    }

    var allowedOrigins = payload.AllowedOrigins
      .Select(NormalizeOrigin)
      .Distinct(StringComparer.Ordinal)
      .ToArray();
    credentialStore.Save(new BridgeCredential(
      request.GatewayBaseUrl.GetLeftPart(UriPartial.Authority),
      payload.Device.DeviceId,
      payload.DeviceCredential,
      allowedOrigins));
  }

  private static string BridgeVersion()
  {
    return typeof(BridgeIdentity)
      .Assembly
      .GetName()
      .Version?
      .ToString(3)
      ?? "0.0.0";
  }

  private static string NormalizeOrigin(string value)
  {
    if (!Uri.TryCreate(value, UriKind.Absolute, out var uri)
        || (uri.Scheme != Uri.UriSchemeHttps
          && uri.Scheme != Uri.UriSchemeHttp)
        || !string.IsNullOrEmpty(uri.UserInfo)
        || uri.AbsolutePath != "/"
        || !string.IsNullOrEmpty(uri.Query)
        || !string.IsNullOrEmpty(uri.Fragment))
    {
      throw new JsonException("Gateway returned an invalid allowed origin.");
    }

    return uri.GetLeftPart(UriPartial.Authority);
  }

  private sealed record RedeemRequest(
    string BridgeVersion,
    string DeviceName,
    string PairingCode,
    string Platform);

  private sealed record RedeemResponse(
    string[] AllowedOrigins,
    DeviceResponse Device,
    string DeviceCredential,
    string RequestId);

  private sealed record DeviceResponse(string DeviceId);
}
