using NewEmby.PlayerBridge.Hosting;

namespace NewEmby.PlayerBridge;

internal static class Program
{
  private static async Task<int> Main(string[] args)
  {
    await using var application = BridgeHost.Build(args);

    await application.RunAsync();
    return 0;
  }
}
