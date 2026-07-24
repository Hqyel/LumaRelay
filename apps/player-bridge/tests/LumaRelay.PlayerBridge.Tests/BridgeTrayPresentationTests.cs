using LumaRelay.PlayerBridge.Lifecycle;

namespace LumaRelay.PlayerBridge.Tests;

public sealed class BridgeTrayPresentationTests
{
  [Fact]
  public void ShowsBridgeIdentityVersionAndExitAction()
  {
    var presentation = BridgeTrayPresentation.Create();

    Assert.Equal("LumaRelay Player Bridge", presentation.Title);
    Assert.Equal(
      "LumaRelay Player Bridge 0.1.0",
      presentation.StatusText);
    Assert.Equal("退出", presentation.ExitText);
  }
}
