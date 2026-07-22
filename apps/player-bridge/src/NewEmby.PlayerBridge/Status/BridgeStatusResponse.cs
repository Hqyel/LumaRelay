using System.Globalization;
using NewEmby.PlayerBridge.MediaSessions;

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

internal sealed record BridgeSmtcStatus(
  string Capability,
  bool IsMonitoring,
  int SessionCount,
  int PotPlayerSessionCount,
  string PotPlayerSessionState);

internal sealed record BridgeStatusResponse(
  string ApplicationId,
  string BridgeVersion,
  int ApiVersion,
  BridgeApiCompatibility Compatibility,
  string Status,
  string Platform,
  string Architecture,
  string? DeviceId,
  bool IsPaired,
  IReadOnlyList<BridgePlayerStatus> Players,
  BridgeSmtcStatus Smtc)
{
  public static BridgeStatusResponse Create(
    string? requestedVersion,
    string? deviceId,
    IReadOnlyList<BridgePlayerStatus> players,
    SmtcMonitorSnapshot smtc)
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
      deviceId,
      deviceId is not null,
      players,
      CreateSmtcStatus(smtc));
  }

  private static BridgeSmtcStatus CreateSmtcStatus(
    SmtcMonitorSnapshot snapshot)
  {
    var capability = snapshot.Capability switch
    {
      SmtcCapability.Ready => "ready",
      SmtcCapability.Unavailable => "unavailable",
      _ => "unsupported",
    };
    var sessionState = snapshot.PotPlayerSessionCount > 0
      ? "detected"
      : "notObserved";

    return new BridgeSmtcStatus(
      capability,
      snapshot.IsMonitoring,
      snapshot.SessionCount,
      snapshot.PotPlayerSessionCount,
      sessionState);
  }
}
