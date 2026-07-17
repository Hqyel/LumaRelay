using NewEmby.PlayerBridge.Hosting;
using NewEmby.PlayerBridge.Protocol;
using NewEmby.PlayerBridge.Startup;

namespace NewEmby.PlayerBridge;

internal static class Program
{
  private static async Task<int> Main(string[] args)
  {
    var command = BridgeCommandLine.Parse(args);
    if (command.Action is not BridgeStartupAction.Run)
      return RunProtocolRegistration(command.Action);

    await using var application = BridgeHost.Build(command.HostArguments);

    await application.RunAsync();
    return 0;
  }

  private static int RunProtocolRegistration(BridgeStartupAction action)
  {
    if (!OperatingSystem.IsWindows())
    {
      Console.Error.WriteLine("Protocol registration requires Windows.");
      return 1;
    }

    var executablePath = Environment.ProcessPath;
    if (string.IsNullOrWhiteSpace(executablePath))
    {
      Console.Error.WriteLine("Unable to resolve the Bridge executable path.");
      return 1;
    }

    try
    {
      var registry = new WindowsProtocolRegistry();
      if (action is BridgeStartupAction.RegisterProtocol)
      {
        ProtocolRegistration.Register(executablePath, registry);
        Console.WriteLine("newemby:// protocol registered for the current user.");
      }
      else
      {
        ProtocolRegistration.Unregister(registry);
        Console.WriteLine("newemby:// protocol unregistered for the current user.");
      }

      return 0;
    }
    catch (Exception exception)
    {
      Console.Error.WriteLine(
        $"Protocol registration failed: {exception.Message}");
      return 1;
    }
  }
}
