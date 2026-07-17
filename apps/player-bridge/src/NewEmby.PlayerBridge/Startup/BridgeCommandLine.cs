namespace NewEmby.PlayerBridge.Startup;

using NewEmby.PlayerBridge.Pairing;

internal enum BridgeStartupAction
{
  Run,
  Pair,
  RegisterProtocol,
  Shutdown,
  UnregisterProtocol,
}

internal sealed record BridgeStartupCommand(
  BridgeStartupAction Action,
  string[] HostArguments,
  BridgePairingRequest? PairingRequest = null);

internal static class BridgeCommandLine
{
  private const string RegisterArgument = "--register-protocol";
  private const string PairArgument = "--pair";
  private const string ProtocolArgument = "--protocol";
  private const string ShutdownArgument = "--shutdown";
  private const string UnregisterArgument = "--unregister-protocol";

  public static BridgeStartupCommand Parse(string[] args)
  {
    if (args.Length == 3
        && string.Equals(
          args[0],
          PairArgument,
          StringComparison.OrdinalIgnoreCase))
    {
      return new BridgeStartupCommand(
        BridgeStartupAction.Pair,
        [],
        BridgePairingRequest.Create(args[1], args[2]));
    }

    if (args.Length == 2
        && string.Equals(
          args[0],
          ProtocolArgument,
          StringComparison.OrdinalIgnoreCase)
        && BridgePairingRequest.TryCreateFromProtocol(
          args[1],
          out var pairingRequest))
    {
      return new BridgeStartupCommand(
        BridgeStartupAction.Pair,
        [],
        pairingRequest);
    }

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

    if (args.Length == 1
        && string.Equals(
          args[0],
          ShutdownArgument,
          StringComparison.OrdinalIgnoreCase))
    {
      return new BridgeStartupCommand(BridgeStartupAction.Shutdown, []);
    }

    return new BridgeStartupCommand(BridgeStartupAction.Run, args);
  }
}
