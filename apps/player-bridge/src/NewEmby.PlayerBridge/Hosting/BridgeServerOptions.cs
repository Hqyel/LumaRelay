using System.Globalization;
using Microsoft.Extensions.Configuration;

namespace NewEmby.PlayerBridge.Hosting;

internal sealed record BridgeServerOptions(int Port)
{
  public const int DefaultPort = 58080;

  private const string CommandLinePortKey = "bridge-port";
  private const string EnvironmentPortKey = "NEWEMBY_BRIDGE_PORT";

  public static BridgeServerOptions FromConfiguration(
    IConfiguration configuration)
  {
    var configuredPort = configuration[CommandLinePortKey]
      ?? configuration[EnvironmentPortKey];

    if (string.IsNullOrWhiteSpace(configuredPort))
      return new BridgeServerOptions(DefaultPort);

    if (!int.TryParse(
          configuredPort,
          NumberStyles.None,
          CultureInfo.InvariantCulture,
          out var port)
        || port is < 1024 or > 65535)
    {
      throw new InvalidOperationException(
        "NEWEMBY_BRIDGE_PORT must be an integer from 1024 to 65535.");
    }

    return new BridgeServerOptions(port);
  }
}
