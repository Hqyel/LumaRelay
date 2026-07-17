using NewEmby.PlayerBridge.Lifecycle;

namespace NewEmby.PlayerBridge.Tests;

public sealed class BridgeTrayPresentationTests
{
  [Fact]
  public void ShowsBridgeIdentityVersionAndExitAction()
  {
    var presentation = BridgeTrayPresentation.Create();

    Assert.Equal("NewEmby Player Bridge", presentation.Title);
    Assert.Equal(
      "NewEmby Player Bridge 0.1.0",
      presentation.StatusText);
    Assert.Equal("退出", presentation.ExitText);
  }
}
