using NewEmby.PlayerBridge.Pairing;

namespace NewEmby.PlayerBridge.Tests;

public sealed class BridgePairingRequestTests
{
  private const string PairingCode =
    "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

  [Fact]
  public void ParsesPairingProtocolUri()
  {
    var gateway = Uri.EscapeDataString("https://newemby.example.com");
    var uri = $"newemby://pair?gateway={gateway}&code={PairingCode}";

    var parsed = BridgePairingRequest.TryCreateFromProtocol(
      uri,
      out var request);

    Assert.True(parsed);
    Assert.NotNull(request);
    Assert.Equal("https://newemby.example.com/", request.GatewayBaseUrl.ToString());
    Assert.Equal(PairingCode, request.PairingCode);
  }

  [Theory]
  [InlineData("http://127.0.0.1:3000", true)]
  [InlineData("http://localhost:3000", true)]
  [InlineData("https://newemby.example.com", true)]
  [InlineData("http://newemby.example.com", false)]
  [InlineData("https://user@example.com", false)]
  public void AcceptsOnlySecureOrLoopbackGateway(
    string gateway,
    bool expected)
  {
    var exception = Record.Exception(() =>
      BridgePairingRequest.Create(gateway, PairingCode));

    Assert.Equal(expected, exception is null);
  }

  [Fact]
  public void RejectsMalformedPairingCode()
  {
    Assert.Throws<ArgumentException>(() =>
      BridgePairingRequest.Create(
        "https://newemby.example.com",
        "short"));
  }
}
