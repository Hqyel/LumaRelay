using NewEmby.PlayerBridge.Security;

namespace NewEmby.PlayerBridge.Pairing;

internal sealed class BridgeUnpairingClient(
  HttpClient httpClient,
  IBridgeCredentialStore credentialStore)
{
  public async Task UnpairAsync(
    CancellationToken cancellationToken = default)
  {
    var credential = credentialStore.Read();
    if (credential is null)
      return;

    var endpoint = new Uri(
      new Uri(credential.GatewayBaseUrl),
      $"/api/v1/bridge/devices/{credential.DeviceId}/credential");
    using var request = new HttpRequestMessage(HttpMethod.Delete, endpoint);
    BridgeDeviceAuthentication.Apply(
      request,
      credential,
      BridgeDeviceAuthentication.CreateNonce());
    using var response = await httpClient.SendAsync(
      request,
      cancellationToken);

    if (response.IsSuccessStatusCode
        || response.StatusCode is System.Net.HttpStatusCode.Unauthorized)
    {
      credentialStore.Delete();
      return;
    }

    throw new InvalidOperationException(
      $"Gateway rejected Bridge unpairing with HTTP "
      + $"{(int)response.StatusCode}.");
  }
}
