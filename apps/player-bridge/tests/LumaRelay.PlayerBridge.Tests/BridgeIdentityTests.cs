namespace LumaRelay.PlayerBridge.Tests;

public sealed class BridgeIdentityTests
{
  [Fact]
  public void UsesPublishedApplicationIdentity()
  {
    Assert.Equal("LumaRelay.PlayerBridge", BridgeIdentity.ApplicationId);
    Assert.Equal("LumaRelay Player Bridge", BridgeIdentity.DisplayName);
    Assert.Equal(1, BridgeIdentity.ApiVersion);
    Assert.Equal(1, BridgeIdentity.MinimumClientApiVersion);
    Assert.Equal(1, BridgeIdentity.MaximumClientApiVersion);
  }
}
