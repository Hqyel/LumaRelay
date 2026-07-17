namespace NewEmby.PlayerBridge.Protocol;

internal interface IProtocolRegistry
{
  void DeleteTree(string keyPath);
  void WriteString(string keyPath, string valueName, string value);
}
