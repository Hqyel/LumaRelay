using System.Runtime.Versioning;
using Microsoft.Win32;

namespace NewEmby.PlayerBridge.Protocol;

[SupportedOSPlatform("windows")]
internal sealed class WindowsProtocolRegistry : IProtocolRegistry
{
  public void DeleteTree(string keyPath)
  {
    Registry.CurrentUser.DeleteSubKeyTree(
      keyPath,
      throwOnMissingSubKey: false);
  }

  public void WriteString(
    string keyPath,
    string valueName,
    string value)
  {
    using var key = Registry.CurrentUser.CreateSubKey(
      keyPath,
      writable: true);

    if (key is null)
      throw new InvalidOperationException("Unable to open the protocol key.");

    key.SetValue(valueName, value, RegistryValueKind.String);
  }
}
