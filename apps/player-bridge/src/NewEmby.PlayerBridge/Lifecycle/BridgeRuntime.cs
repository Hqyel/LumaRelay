using NewEmby.PlayerBridge.Hosting;

namespace NewEmby.PlayerBridge.Lifecycle;

internal static class BridgeRuntime
{
  public static int Run(string[] args)
  {
#if WINDOWS
    return WindowsBridgeRuntime.Run(args);
#else
    var application = BridgeHost.Build(args);

    try
    {
      application.RunAsync().GetAwaiter().GetResult();
      return 0;
    }
    finally
    {
      application.DisposeAsync().AsTask().GetAwaiter().GetResult();
    }
#endif
  }

  public static int SignalShutdown()
  {
#if WINDOWS
    return WindowsBridgeRuntime.SignalShutdown() ? 0 : 1;
#else
    Console.Error.WriteLine("Bridge shutdown signaling requires Windows.");
    return 1;
#endif
  }
}
