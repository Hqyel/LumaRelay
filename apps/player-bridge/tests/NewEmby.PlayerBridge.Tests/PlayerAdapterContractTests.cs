using NewEmby.PlayerBridge.Players;

namespace NewEmby.PlayerBridge.Tests;

public sealed class PlayerAdapterContractTests
{
  [Fact]
  public void ExposesStableAdapterIdentity()
  {
    IPlayerAdapter adapter = new TestPlayerAdapter();

    Assert.Equal("test", adapter.AdapterId);
    Assert.Equal("Test Player", adapter.DisplayName);
  }

  private sealed class TestPlayerAdapter : IPlayerAdapter
  {
    public string AdapterId => "test";
    public string DisplayName => "Test Player";
  }
}
