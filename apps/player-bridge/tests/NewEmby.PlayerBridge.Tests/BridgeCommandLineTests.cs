using NewEmby.PlayerBridge.Startup;

namespace NewEmby.PlayerBridge.Tests;

public sealed class BridgeCommandLineTests
{
  [Theory]
  [InlineData("--register-protocol", "RegisterProtocol")]
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
}
