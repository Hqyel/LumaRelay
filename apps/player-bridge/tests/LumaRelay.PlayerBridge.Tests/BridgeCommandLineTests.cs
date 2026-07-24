using LumaRelay.PlayerBridge.Startup;

namespace LumaRelay.PlayerBridge.Tests;

public sealed class BridgeCommandLineTests
{
  [Theory]
  [InlineData("--register-protocol", "RegisterProtocol")]
  [InlineData("--shutdown", "Shutdown")]
  [InlineData("--unpair", "Unpair")]
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
    var arguments = new[] { "--protocol", "lumarelay://play/example" };

    var command = BridgeCommandLine.Parse(arguments);

    Assert.Equal(BridgeStartupAction.Run, command.Action);
    Assert.Same(arguments, command.HostArguments);
  }

  [Fact]
  public void RecognizesPairingProtocolActivation()
  {
    const string code =
      "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    var gateway = Uri.EscapeDataString("https://lumarelay.example.com");
    var command = BridgeCommandLine.Parse([
      "--protocol",
      $"lumarelay://pair?gateway={gateway}&code={code}",
    ]);

    Assert.Equal(BridgeStartupAction.Pair, command.Action);
    Assert.NotNull(command.PairingRequest);
    Assert.Equal(code, command.PairingRequest.PairingCode);
    Assert.Empty(command.HostArguments);
  }
}
