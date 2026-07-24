using System.Net.Http.Headers;
using System.Security.Cryptography;
using LumaRelay.PlayerBridge.Pairing;

namespace LumaRelay.PlayerBridge.Security;

internal static class BridgeDeviceAuthentication
{
  public const string NonceHeaderName = "X-LumaRelay-Nonce";

  public static string CreateNonce()
  {
    return Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
      .TrimEnd('=')
      .Replace('+', '-')
      .Replace('/', '_');
  }

  public static void Apply(
    HttpRequestMessage request,
    BridgeCredential credential,
    string nonce)
  {
    ArgumentNullException.ThrowIfNull(request);
    ArgumentNullException.ThrowIfNull(credential);

    request.Headers.Authorization = new AuthenticationHeaderValue(
      "LumaRelayDevice",
      credential.DeviceCredential);
    request.Headers.Add(NonceHeaderName, nonce);
  }
}
