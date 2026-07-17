using NewEmby.PlayerBridge.Pairing;
using NewEmby.PlayerBridge.Security;

namespace NewEmby.PlayerBridge.Tests;

public sealed class BridgeDeviceAuthenticationTests
{
  [Fact]
  public void AddsDeviceCredentialAndFreshNonceHeaders()
  {
    var credential = new BridgeCredential(
      "https://gateway.example.com",
      "11111111-1111-4111-8111-111111111111",
      "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      ["https://newemby.example.com"]);
    using var request = new HttpRequestMessage(
      HttpMethod.Post,
      "https://gateway.example.com/api/v1/bridge/heartbeat");
    var nonce = BridgeDeviceAuthentication.CreateNonce();

    BridgeDeviceAuthentication.Apply(request, credential, nonce);

    Assert.Equal(43, nonce.Length);
    Assert.Equal("NewEmbyDevice", request.Headers.Authorization?.Scheme);
    Assert.Equal(
      credential.DeviceCredential,
      request.Headers.Authorization?.Parameter);
    Assert.Equal(
      nonce,
      request.Headers.GetValues(
        BridgeDeviceAuthentication.NonceHeaderName).Single());
  }
}
