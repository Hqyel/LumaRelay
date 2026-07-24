using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using System.Net.Sockets;
using LumaRelay.PlayerBridge.Hosting;
using LumaRelay.PlayerBridge.MediaSessions;
using LumaRelay.PlayerBridge.Pairing;
using LumaRelay.PlayerBridge.Players;
using LumaRelay.PlayerBridge.Status;

namespace LumaRelay.PlayerBridge.Tests;

public sealed class BridgeStatusEndpointTests
{
  [Theory]
  [InlineData(null, true, null)]
  [InlineData("1", true, 1)]
  [InlineData("2", false, 2)]
  [InlineData("invalid", false, null)]
  public async Task ReturnsVersionCompatibility(
    string? requestedVersion,
    bool expectedCompatibility,
    int? expectedRequestedVersion)
  {
    var port = ReserveLoopbackPort();
    await using var application = BridgeHost.Build(
      ["--bridge-port", port.ToString(CultureInfo.InvariantCulture)],
      new EmptyCredentialStore(),
      playerDiscovery: new EmptyPlayerDiscovery());
    await application.StartAsync();

    using var handler = new SocketsHttpHandler { UseProxy = false };
    using var client = new HttpClient(handler);
    var query = requestedVersion is null
      ? string.Empty
      : $"?apiVersion={requestedVersion}";
    var uri = $"http://127.0.0.1:{port}/v1/status{query}";
    using var response = await client.GetAsync(uri);
    var status = await response.Content
      .ReadFromJsonAsync<BridgeStatusResponse>();

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    Assert.Equal(
      "application/json",
      response.Content.Headers.ContentType?.MediaType);
    Assert.True(response.Headers.CacheControl?.NoStore);
    Assert.NotNull(status);
    Assert.Equal("LumaRelay.PlayerBridge", status.ApplicationId);
    Assert.Equal("0.1.0", status.BridgeVersion);
    Assert.Equal(1, status.ApiVersion);
    Assert.Equal("ready", status.Status);
    Assert.Equal("windows", status.Platform);
    Assert.Equal("x64", status.Architecture);
    Assert.Null(status.DeviceId);
    Assert.False(status.IsPaired);
    Assert.Empty(status.Players);
    Assert.Equal("unsupported", status.Smtc.Capability);
    Assert.False(status.Smtc.IsMonitoring);
    Assert.Equal(0, status.Smtc.SessionCount);
    Assert.Equal(0, status.Smtc.PotPlayerSessionCount);
    Assert.Equal("notObserved", status.Smtc.PotPlayerSessionState);
    Assert.Equal(expectedCompatibility, status.Compatibility.IsCompatible);
    Assert.Equal(
      expectedRequestedVersion,
      status.Compatibility.RequestedApiVersion);
    Assert.Equal(1, status.Compatibility.MinimumClientApiVersion);
    Assert.Equal(1, status.Compatibility.MaximumClientApiVersion);

    await application.StopAsync();
  }

  [Fact]
  public async Task ReportsStoredPairingState()
  {
    var port = ReserveLoopbackPort();
    await using var application = BridgeHost.Build(
      ["--bridge-port", port.ToString(CultureInfo.InvariantCulture)],
      new StoredCredentialStore(),
      playerDiscovery: new EmptyPlayerDiscovery());
    await application.StartAsync();

    using var handler = new SocketsHttpHandler { UseProxy = false };
    using var client = new HttpClient(handler);
    var status = await client.GetFromJsonAsync<BridgeStatusResponse>(
      $"http://127.0.0.1:{port}/v1/status");

    Assert.NotNull(status);
    Assert.True(status.IsPaired);
    Assert.Equal(
      "11111111-1111-4111-8111-111111111111",
      status.DeviceId);
    await application.StopAsync();
  }

  [Fact]
  public async Task ReportsDiscoveredPlayerWithoutMachinePath()
  {
    var port = ReserveLoopbackPort();
    await using var application = BridgeHost.Build(
      ["--bridge-port", port.ToString(CultureInfo.InvariantCulture)],
      new EmptyCredentialStore(),
      playerDiscovery: new InstalledPlayerDiscovery());
    await application.StartAsync();

    using var handler = new SocketsHttpHandler { UseProxy = false };
    using var client = new HttpClient(handler);
    using var response = await client.GetAsync(
      $"http://127.0.0.1:{port}/v1/status");
    var json = await response.Content.ReadAsStringAsync();
    var status = await response.Content
      .ReadFromJsonAsync<BridgeStatusResponse>();

    Assert.NotNull(status);
    var player = Assert.Single(status.Players);
    Assert.Equal("potplayer", player.AdapterId);
    Assert.Equal("PotPlayer", player.DisplayName);
    Assert.True(player.IsAvailable);
    Assert.Equal("1.7.22398.0", player.Version);
    Assert.Equal("x64", player.Architecture);
    Assert.True(player.IsRunning);
    Assert.DoesNotContain("C:\\", json, StringComparison.OrdinalIgnoreCase);

    await application.StopAsync();
  }

  [Fact]
  public async Task ReportsHostedSmtcCapabilityWithoutSessionIdentity()
  {
    var port = ReserveLoopbackPort();
    var monitor = new ReadySmtcMonitor();
    await using var application = BridgeHost.Build(
      ["--bridge-port", port.ToString(CultureInfo.InvariantCulture)],
      new EmptyCredentialStore(),
      playerDiscovery: new EmptyPlayerDiscovery(),
      smtcMonitor: monitor);
    await application.StartAsync();

    using var handler = new SocketsHttpHandler { UseProxy = false };
    using var client = new HttpClient(handler);
    using var response = await client.GetAsync(
      $"http://127.0.0.1:{port}/v1/status");
    var json = await response.Content.ReadAsStringAsync();
    var status = await response.Content
      .ReadFromJsonAsync<BridgeStatusResponse>();

    Assert.True(monitor.IsStarted);
    Assert.NotNull(status);
    Assert.Equal("ready", status.Smtc.Capability);
    Assert.True(status.Smtc.IsMonitoring);
    Assert.Equal(3, status.Smtc.SessionCount);
    Assert.Equal(1, status.Smtc.PotPlayerSessionCount);
    Assert.Equal("detected", status.Smtc.PotPlayerSessionState);
    Assert.DoesNotContain(
      "sensitive.application.id",
      json,
      StringComparison.Ordinal);

    await application.StopAsync();
    Assert.True(monitor.IsStopped);
  }

  private sealed class EmptyPlayerDiscovery : IPlayerDiscovery
  {
    public IReadOnlyList<DiscoveredPlayer> Discover()
    {
      return [];
    }
  }

  private sealed class InstalledPlayerDiscovery : IPlayerDiscovery
  {
    public IReadOnlyList<DiscoveredPlayer> Discover()
    {
      return
      [
        new DiscoveredPlayer(
          "potplayer",
          "PotPlayer",
          "1.7.22398.0",
          "x64",
          true,
          @"C:\Program Files\DAUM\PotPlayer\PotPlayerMini64.exe"),
      ];
    }
  }

  private sealed class ReadySmtcMonitor : ISystemMediaSessionMonitor
  {
    public event EventHandler<SmtcSessionEventArgs>? Changed;

    public bool IsStarted { get; private set; }
    public bool IsStopped { get; private set; }

    public SmtcMonitorSnapshot Snapshot { get; private set; } =
      SmtcMonitorSnapshot.Unsupported;
    public IReadOnlyList<ISmtcSession> Sessions => [];

    public Task StartAsync(CancellationToken cancellationToken)
    {
      IsStarted = true;
      Snapshot = new SmtcMonitorSnapshot(
        SmtcCapability.Ready,
        true,
        3,
        1);
      Changed?.Invoke(
        this,
        new SmtcSessionEventArgs(
          SmtcSessionEventKind.SessionsChanged,
          "sensitive.application.id",
          Snapshot));
      return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
      IsStopped = true;
      return Task.CompletedTask;
    }
  }

  private sealed class EmptyCredentialStore : IBridgeCredentialStore
  {
    public void Delete()
    {
    }

    public BridgeCredential? Read()
    {
      return null;
    }

    public void Save(BridgeCredential credential)
    {
    }
  }

  private sealed class StoredCredentialStore : IBridgeCredentialStore
  {
    private static readonly BridgeCredential Credential = new(
      "https://gateway.example.com",
      "11111111-1111-4111-8111-111111111111",
      "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      ["https://lumarelay.example.com"]);

    public void Delete()
    {
    }

    public BridgeCredential? Read()
    {
      return Credential;
    }

    public void Save(BridgeCredential credential)
    {
    }
  }

  private static int ReserveLoopbackPort()
  {
    var listener = new TcpListener(IPAddress.Loopback, 0);

    try
    {
      listener.Start();
      return ((IPEndPoint)listener.LocalEndpoint).Port;
    }
    finally
    {
      listener.Stop();
    }
  }
}
