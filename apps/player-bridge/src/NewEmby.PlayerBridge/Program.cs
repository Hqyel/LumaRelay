using System.Reflection;

namespace NewEmby.PlayerBridge;

internal static class Program
{
  private static int Main()
  {
    var version = Assembly.GetExecutingAssembly().GetName().Version;
    var displayVersion = version?.ToString(3) ?? "0.0.0";

    Console.WriteLine($"{BridgeIdentity.DisplayName} {displayVersion}");
    return 0;
  }
}
