using Microsoft.Extensions.Configuration;
using NewEmby.PlayerBridge.Hosting;

namespace NewEmby.PlayerBridge.Tests;

public sealed class BridgeServerOptionsTests
{
  [Fact]
  public void UsesDefaultPortWhenNoOverrideExists()
  {
    var configuration = CreateConfiguration();

    var options = BridgeServerOptions.FromConfiguration(configuration);

    Assert.Equal(58080, options.Port);
  }

  [Fact]
  public void CommandLinePortOverridesEnvironmentPort()
  {
    var configuration = CreateConfiguration(
      new Dictionary<string, string?>
      {
        ["bridge-port"] = "58100",
        ["NEWEMBY_BRIDGE_PORT"] = "58200",
      });

    var options = BridgeServerOptions.FromConfiguration(configuration);

    Assert.Equal(58100, options.Port);
  }

  [Theory]
  [InlineData("0")]
  [InlineData("1023")]
  [InlineData("65536")]
  [InlineData("not-a-port")]
  public void RejectsUnsafePortValues(string port)
  {
    var configuration = CreateConfiguration(
      new Dictionary<string, string?>
      {
        ["NEWEMBY_BRIDGE_PORT"] = port,
      });

    var exception = Assert.Throws<InvalidOperationException>(() =>
      BridgeServerOptions.FromConfiguration(configuration));

    Assert.Contains("1024 to 65535", exception.Message);
  }

  private static IConfiguration CreateConfiguration(
    Dictionary<string, string?>? values = null)
  {
    return new ConfigurationBuilder()
      .AddInMemoryCollection(values)
      .Build();
  }
}
