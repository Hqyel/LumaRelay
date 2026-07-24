using LumaRelay.PlayerBridge.Pairing;

namespace LumaRelay.PlayerBridge.Tests;

public sealed class WindowsCredentialStoreTests
{
  [Fact]
  public void RoundTripsCredentialForCurrentWindowsUser()
  {
    if (!OperatingSystem.IsWindows())
      return;

    var target = $"LumaRelay.PlayerBridge.Tests.{Guid.NewGuid():N}";
    var store = new WindowsCredentialStore(target);
    var credential = new BridgeCredential(
      "https://gateway.example.com",
      "11111111-1111-4111-8111-111111111111",
      "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      ["https://lumarelay.example.com"]);

    try
    {
      store.Save(credential);

      var stored = store.Read();
      Assert.NotNull(stored);
      Assert.Equal(credential.GatewayBaseUrl, stored.GatewayBaseUrl);
      Assert.Equal(credential.DeviceId, stored.DeviceId);
      Assert.Equal(credential.DeviceCredential, stored.DeviceCredential);
      Assert.Equal(credential.AllowedOrigins, stored.AllowedOrigins);
    }
    finally
    {
      store.Delete();
    }

    Assert.Null(store.Read());
  }
}
