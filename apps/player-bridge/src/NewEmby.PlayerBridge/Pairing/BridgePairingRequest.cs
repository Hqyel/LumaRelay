using System.Net;
using System.Text.RegularExpressions;

namespace NewEmby.PlayerBridge.Pairing;

internal sealed partial record BridgePairingRequest(
  Uri GatewayBaseUrl,
  string PairingCode)
{
  public static BridgePairingRequest Create(
    string gatewayBaseUrl,
    string pairingCode)
  {
    if (!Uri.TryCreate(gatewayBaseUrl, UriKind.Absolute, out var gateway))
    {
      throw new ArgumentException(
        "Gateway URL must be absolute.",
        nameof(gatewayBaseUrl));
    }

    if (!IsAllowedGateway(gateway))
    {
      throw new ArgumentException(
        "Gateway URL must use HTTPS or loopback HTTP.",
        nameof(gatewayBaseUrl));
    }

    if (!PairingCodePattern().IsMatch(pairingCode))
    {
      throw new ArgumentException(
        "Pairing code has an invalid format.",
        nameof(pairingCode));
    }

    var origin = new UriBuilder(
      gateway.Scheme,
      gateway.Host,
      gateway.IsDefaultPort ? -1 : gateway.Port).Uri;
    return new BridgePairingRequest(origin, pairingCode);
  }

  public static bool TryCreateFromProtocol(
    string value,
    out BridgePairingRequest? request)
  {
    request = null;
    if (!Uri.TryCreate(value, UriKind.Absolute, out var uri)
        || !string.Equals(uri.Scheme, "newemby", StringComparison.Ordinal)
        || !string.Equals(uri.Host, "pair", StringComparison.Ordinal))
    {
      return false;
    }

    var parameters = ParseQuery(uri.Query);
    if (!parameters.TryGetValue("gateway", out var gateway)
        || !parameters.TryGetValue("code", out var code))
    {
      return false;
    }

    try
    {
      request = Create(gateway, code);
      return true;
    }
    catch (ArgumentException)
    {
      return false;
    }
  }

  private static bool IsAllowedGateway(Uri gateway)
  {
    if (!string.IsNullOrEmpty(gateway.UserInfo)
        || !string.IsNullOrEmpty(gateway.Query)
        || !string.IsNullOrEmpty(gateway.Fragment))
    {
      return false;
    }

    if (string.Equals(gateway.Scheme, Uri.UriSchemeHttps,
          StringComparison.OrdinalIgnoreCase))
    {
      return true;
    }

    return string.Equals(gateway.Scheme, Uri.UriSchemeHttp,
        StringComparison.OrdinalIgnoreCase)
      && (string.Equals(gateway.Host, "localhost",
          StringComparison.OrdinalIgnoreCase)
        || (IPAddress.TryParse(gateway.Host, out var address)
          && IPAddress.IsLoopback(address)));
  }

  private static Dictionary<string, string> ParseQuery(string query)
  {
    var result = new Dictionary<string, string>(StringComparer.Ordinal);
    foreach (var pair in query.TrimStart('?').Split(
      '&',
      StringSplitOptions.RemoveEmptyEntries))
    {
      var separator = pair.IndexOf('=');
      if (separator <= 0)
        continue;

      var key = Uri.UnescapeDataString(pair[..separator]);
      var value = Uri.UnescapeDataString(pair[(separator + 1)..]);
      if (!result.TryAdd(key, value))
        return new Dictionary<string, string>();
    }

    return result;
  }

  [GeneratedRegex("^[A-Za-z0-9_-]{43}$", RegexOptions.CultureInvariant)]
  private static partial Regex PairingCodePattern();
}
