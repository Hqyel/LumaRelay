using LumaRelay.PlayerBridge.Players;

namespace LumaRelay.PlayerBridge.Tests;

public sealed class PlayerAdapterContractTests
{
  [Fact]
  public void ExposesStableAdapterIdentity()
  {
    IPlayerAdapter adapter = new TestPlayerAdapter();

    Assert.Equal("test", adapter.AdapterId);
    Assert.Equal("Test Player", adapter.DisplayName);
    Assert.Equal(7, adapter.Launch(CreateRequest()).ProcessId);
  }

  private static PlayerLaunchRequest CreateRequest()
  {
    return new PlayerLaunchRequest(
      new Uri("http://127.0.0.1:58080/v1/playback/test/media"),
      0,
      Guid.Empty,
      null);
  }

  private sealed class TestPlayerAdapter : IPlayerAdapter
  {
    public string AdapterId => "test";
    public string DisplayName => "Test Player";

    public PlayerLaunchResult Launch(PlayerLaunchRequest request)
    {
      return new PlayerLaunchResult(7, request.PlaySessionId, default);
    }
  }
}
