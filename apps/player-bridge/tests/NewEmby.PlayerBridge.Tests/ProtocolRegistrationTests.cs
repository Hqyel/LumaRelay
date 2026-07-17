using NewEmby.PlayerBridge.Protocol;

namespace NewEmby.PlayerBridge.Tests;

public sealed class ProtocolRegistrationTests
{
  [Fact]
  public void WritesPerUserProtocolRegistrationWithQuotedArguments()
  {
    var executablePath = Path.GetFullPath(
      Path.Combine("bridge", "NewEmby.PlayerBridge.exe"));
    var registry = new RecordingProtocolRegistry();

    ProtocolRegistration.Register(executablePath, registry);

    var quotedPath = $"\"{executablePath}\"";
    Assert.Equal(
      "URL:NewEmby Protocol",
      registry.Values[(ProtocolRegistration.ProtocolKey, string.Empty)]);
    Assert.Equal(
      string.Empty,
      registry.Values[(ProtocolRegistration.ProtocolKey, "URL Protocol")]);
    Assert.Equal(
      $"{quotedPath},0",
      registry.Values[(ProtocolRegistration.DefaultIconKey, string.Empty)]);
    Assert.Equal(
      $"{quotedPath} --protocol \"%1\"",
      registry.Values[(ProtocolRegistration.CommandKey, string.Empty)]);
  }

  [Fact]
  public void RemovesOnlyTheNewEmbyProtocolTree()
  {
    var registry = new RecordingProtocolRegistry();

    ProtocolRegistration.Unregister(registry);

    Assert.Equal(ProtocolRegistration.ProtocolKey, registry.DeletedTree);
  }

  [Theory]
  [InlineData("")]
  [InlineData("not-an-executable.txt")]
  [InlineData("bad\"path.exe")]
  public void RejectsUnsafeExecutablePath(string executablePath)
  {
    var registry = new RecordingProtocolRegistry();

    Assert.Throws<ArgumentException>(() =>
      ProtocolRegistration.Register(executablePath, registry));
    Assert.Empty(registry.Values);
  }

  private sealed class RecordingProtocolRegistry : IProtocolRegistry
  {
    public string? DeletedTree { get; private set; }

    public Dictionary<(string KeyPath, string ValueName), string> Values
    {
      get;
    } = [];

    public void DeleteTree(string keyPath)
    {
      DeletedTree = keyPath;
    }

    public void WriteString(
      string keyPath,
      string valueName,
      string value)
    {
      Values[(keyPath, valueName)] = value;
    }
  }
}
