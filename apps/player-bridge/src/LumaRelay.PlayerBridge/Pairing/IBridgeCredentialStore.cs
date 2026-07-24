namespace LumaRelay.PlayerBridge.Pairing;

internal interface IBridgeCredentialStore
{
  void Delete();

  BridgeCredential? Read();

  void Save(BridgeCredential credential);
}
