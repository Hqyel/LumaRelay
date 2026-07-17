namespace NewEmby.PlayerBridge.Pairing;

internal sealed record BridgeCredential(
  string GatewayBaseUrl,
  string DeviceId,
  string DeviceCredential,
  IReadOnlyList<string> AllowedOrigins);
