namespace NewEmby.PlayerBridge.Startup;

internal enum BridgeStartupAction
{
  Run,
  RegisterProtocol,
  UnregisterProtocol,
}

internal sealed record BridgeStartupCommand(
  BridgeStartupAction Action,
  string[] HostArguments);

internal static class BridgeCommandLine
{
  private const string RegisterArgument = "--register-protocol";
  private const string UnregisterArgument = "--unregister-protocol";

  public static BridgeStartupCommand Parse(string[] args)
  {
    if (args.Length == 1
        && string.Equals(
          args[0],
          RegisterArgument,
          StringComparison.OrdinalIgnoreCase))
    {
      return new BridgeStartupCommand(
        BridgeStartupAction.RegisterProtocol,
        []);
    }

    if (args.Length == 1
        && string.Equals(
          args[0],
          UnregisterArgument,
          StringComparison.OrdinalIgnoreCase))
    {
      return new BridgeStartupCommand(
        BridgeStartupAction.UnregisterProtocol,
        []);
    }

    return new BridgeStartupCommand(BridgeStartupAction.Run, args);
  }
}
