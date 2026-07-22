using System.Globalization;

namespace NewEmby.PlayerBridge.Status;

internal sealed record BridgeApiCompatibility(
  bool IsCompatible,
  int? RequestedApiVersion,
  int MinimumClientApiVersion,
  int MaximumClientApiVersion);

internal sealed record BridgePlayerStatus(
  string AdapterId,
  string DisplayName,
  bool IsAvailable,
  string Version,
  string Architecture,
  bool IsRunning);

internal sealed record BridgeStatusResponse(
  string ApplicationId,
  string BridgeVersion,
  int ApiVersion,
  BridgeApiCompatibility Compatibility,
  string Status,
  string Platform,
  string Architecture,
  bool IsPaired,
  IReadOnlyList<BridgePlayerStatus> Players)
{
  public static BridgeStatusResponse Create(
    string? requestedVersion,
    bool isPaired,
    IReadOnlyList<BridgePlayerStatus> players)
  {
    var hasVersion = !string.IsNullOrEmpty(requestedVersion);
    var parsed = int.TryParse(
      requestedVersion,
      NumberStyles.None,
      CultureInfo.InvariantCulture,
      out var version);
    var isCompatible = !hasVersion
      || (parsed
        && version >= BridgeIdentity.MinimumClientApiVersion
        && version <= BridgeIdentity.MaximumClientApiVersion);
    var bridgeVersion = typeof(BridgeIdentity)
      .Assembly
      .GetName()
      .Version?
      .ToString(3)
      ?? "0.0.0";

    return new BridgeStatusResponse(
      BridgeIdentity.ApplicationId,
      bridgeVersion,
      BridgeIdentity.ApiVersion,
      new BridgeApiCompatibility(
        isCompatible,
        parsed ? version : null,
        BridgeIdentity.MinimumClientApiVersion,
        BridgeIdentity.MaximumClientApiVersion),
      "ready",
      "windows",
      "x64",
      isPaired,
      players);
  }
}
