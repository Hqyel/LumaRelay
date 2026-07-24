namespace LumaRelay.PlayerBridge.Protocol;

internal static class PortableProtocolRegistration
{
  public static bool TryRegister(
    string? executablePath,
    IProtocolRegistry registry)
  {
    if (string.IsNullOrWhiteSpace(executablePath))
      return false;

    try
    {
      ProtocolRegistration.Register(executablePath, registry);
      return true;
    }
    catch (Exception exception) when (exception is ArgumentException
      or IOException
      or UnauthorizedAccessException)
    {
      return false;
    }
  }
}
