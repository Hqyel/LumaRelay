namespace LumaRelay.PlayerBridge.Lifecycle;

internal sealed record BridgeTrayPresentation(
  string Title,
  string StatusText,
  string ExitText)
{
  public static BridgeTrayPresentation Create()
  {
    var version = typeof(BridgeIdentity)
      .Assembly
      .GetName()
      .Version?
      .ToString(3)
      ?? "0.0.0";

    return new BridgeTrayPresentation(
      BridgeIdentity.DisplayName,
      $"{BridgeIdentity.DisplayName} {version}",
      "退出");
  }
}
