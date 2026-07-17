using NewEmby.PlayerBridge.Security;

namespace NewEmby.PlayerBridge.Tests;

public sealed class BridgeNonceStoreTests
{
  [Fact]
  public void RejectsMalformedAndReplayedNonceWithinWindow()
  {
    var currentTime = new DateTimeOffset(
      2026,
      7,
      17,
      12,
      0,
      0,
      TimeSpan.Zero);
    var store = new BridgeNonceStore(() => currentTime);
    var nonce = new string('N', 43);

    Assert.Equal(NonceUseResult.Invalid, store.TryUse("short"));
    Assert.Equal(NonceUseResult.Accepted, store.TryUse(nonce));
    Assert.Equal(NonceUseResult.Replay, store.TryUse(nonce));

    currentTime = currentTime.AddMinutes(5);
    Assert.Equal(NonceUseResult.Accepted, store.TryUse(nonce));
  }
}
