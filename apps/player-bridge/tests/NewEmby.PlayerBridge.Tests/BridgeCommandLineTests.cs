using NewEmby.PlayerBridge.Startup;

namespace NewEmby.PlayerBridge.Tests;

public sealed class BridgeCommandLineTests
{
  [Theory]
  [InlineData("--register-protocol", "RegisterProtocol")]
  [InlineData("--shutdown", "Shutdown")]
  [InlineData("--unregister-protocol", "UnregisterProtocol")]
  public void RecognizesProtocolMaintenanceCommand(
    string argument,
    string expectedAction)
  {
    var command = BridgeCommandLine.Parse([argument]);

    Assert.Equal(expectedAction, command.Action.ToString());
    Assert.Empty(command.HostArguments);
  }

  [Fact]
  public void PreservesHostAndProtocolActivationArguments()
  {
    var arguments = new[] { "--protocol", "newemby://play/example" };

    var command = BridgeCommandLine.Parse(arguments);

    Assert.Equal(BridgeStartupAction.Run, command.Action);
    Assert.Same(arguments, command.HostArguments);
  }

  [Fact]
  public void RecognizesPairingProtocolActivation()
  {
    const string code =
      "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    var gateway = Uri.EscapeDataString("https://newemby.example.com");
    var command = BridgeCommandLine.Parse([
      "--protocol",
      $"newemby://pair?gateway={gateway}&code={code}",
    ]);

    Assert.Equal(BridgeStartupAction.Pair, command.Action);
    Assert.NotNull(command.PairingRequest);
    Assert.Equal(code, command.PairingRequest.PairingCode);
    Assert.Empty(command.HostArguments);
  }
}
