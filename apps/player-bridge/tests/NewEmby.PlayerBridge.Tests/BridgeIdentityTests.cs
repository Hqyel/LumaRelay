namespace NewEmby.PlayerBridge.Tests;

public sealed class BridgeIdentityTests
{
  [Fact]
  public void UsesPublishedApplicationIdentity()
  {
    Assert.Equal("NewEmby.PlayerBridge", BridgeIdentity.ApplicationId);
    Assert.Equal("NewEmby Player Bridge", BridgeIdentity.DisplayName);
    Assert.Equal(1, BridgeIdentity.ApiVersion);
    Assert.Equal(1, BridgeIdentity.MinimumClientApiVersion);
    Assert.Equal(1, BridgeIdentity.MaximumClientApiVersion);
  }
}
