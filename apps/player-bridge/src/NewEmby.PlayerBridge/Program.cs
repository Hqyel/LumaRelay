using NewEmby.PlayerBridge.Hosting;
using NewEmby.PlayerBridge.Lifecycle;
using NewEmby.PlayerBridge.Pairing;
using NewEmby.PlayerBridge.Protocol;
using NewEmby.PlayerBridge.Startup;

namespace NewEmby.PlayerBridge;

internal static class Program
{
  [STAThread]
  private static int Main(string[] args)
  {
    var command = BridgeCommandLine.Parse(args);
    if (command.Action is BridgeStartupAction.Shutdown)
      return BridgeRuntime.SignalShutdown();

    if (command.Action is BridgeStartupAction.Pair)
      return RunPairing(command.PairingRequest!);

    if (command.Action is BridgeStartupAction.Unpair)
      return RunUnpairing();

    if (command.Action is not BridgeStartupAction.Run)
      return RunProtocolRegistration(command.Action);

    return BridgeRuntime.Run(command.HostArguments);
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

  private static int RunPairing(BridgePairingRequest request)
  {
    if (!OperatingSystem.IsWindows())
    {
      Console.Error.WriteLine("Bridge pairing requires Windows.");
      return 1;
    }

    try
    {
      using var handler = new SocketsHttpHandler
      {
        AllowAutoRedirect = false,
      };
      using var client = new HttpClient(handler)
      {
        Timeout = TimeSpan.FromSeconds(10),
      };
      var pairing = new BridgePairingClient(
        client,
        new WindowsCredentialStore());
      pairing.PairAsync(request, Environment.MachineName)
        .GetAwaiter()
        .GetResult();
      Console.WriteLine("Bridge paired successfully.");
      return 0;
    }
    catch (Exception exception)
    {
      Console.Error.WriteLine($"Bridge pairing failed: {exception.Message}");
      return 1;
    }
  }

  private static int RunUnpairing()
  {
    if (!OperatingSystem.IsWindows())
    {
      Console.Error.WriteLine("Bridge unpairing requires Windows.");
      return 1;
    }

    try
    {
      using var handler = new SocketsHttpHandler
      {
        AllowAutoRedirect = false,
      };
      using var client = new HttpClient(handler)
      {
        Timeout = TimeSpan.FromSeconds(10),
      };
      var unpairing = new BridgeUnpairingClient(
        client,
        new WindowsCredentialStore());
      unpairing.UnpairAsync().GetAwaiter().GetResult();
      Console.WriteLine("Bridge unpaired successfully.");
      return 0;
    }
    catch (Exception exception)
    {
      Console.Error.WriteLine($"Bridge unpairing failed: {exception.Message}");
      return 1;
    }
  }
}
