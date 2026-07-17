using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace NewEmby.PlayerBridge.Pairing;

internal sealed class WindowsCredentialStore : IBridgeCredentialStore
{
  private const int CredentialTypeGeneric = 1;
  private const int CredentialPersistLocalMachine = 2;
  private const int ErrorNotFound = 1168;
  private const int MaximumCredentialSize = 2560;
  private const string DefaultTargetName =
    "NewEmby.PlayerBridge.DeviceCredential";
  private readonly string targetName;

  public WindowsCredentialStore(string? targetName = null)
  {
    this.targetName = targetName ?? DefaultTargetName;
  }

  public void Delete()
  {
    EnsureWindows();

    if (CredDelete(targetName, CredentialTypeGeneric, 0))
      return;

    var error = Marshal.GetLastWin32Error();
    if (error != ErrorNotFound)
      throw new Win32Exception(error, "Unable to delete Bridge credential.");
  }

  public BridgeCredential? Read()
  {
    if (!OperatingSystem.IsWindows())
      return null;

    if (!CredRead(
          targetName,
          CredentialTypeGeneric,
          0,
          out var credentialPointer))
    {
      var error = Marshal.GetLastWin32Error();
      if (error == ErrorNotFound)
        return null;

      throw new Win32Exception(error, "Unable to read Bridge credential.");
    }

    try
    {
      var native = Marshal.PtrToStructure<NativeCredential>(
        credentialPointer);
      if (native.CredentialBlobSize <= 0
          || native.CredentialBlob == IntPtr.Zero)
      {
        return null;
      }

      var payload = new byte[native.CredentialBlobSize];
      try
      {
        Marshal.Copy(native.CredentialBlob, payload, 0, payload.Length);
        return JsonSerializer.Deserialize<BridgeCredential>(payload);
      }
      catch (JsonException)
      {
        return null;
      }
      finally
      {
        CryptographicOperations.ZeroMemory(payload);
      }
    }
    finally
    {
      CredFree(credentialPointer);
    }
  }

  public void Save(BridgeCredential credential)
  {
    ArgumentNullException.ThrowIfNull(credential);
    EnsureWindows();

    var payload = JsonSerializer.SerializeToUtf8Bytes(credential);
    if (payload.Length > MaximumCredentialSize)
    {
      CryptographicOperations.ZeroMemory(payload);
      throw new InvalidOperationException("Bridge credential is too large.");
    }

    var targetPointer = Marshal.StringToCoTaskMemUni(targetName);
    var userPointer = Marshal.StringToCoTaskMemUni(credential.DeviceId);
    var payloadPointer = Marshal.AllocHGlobal(payload.Length);

    try
    {
      Marshal.Copy(payload, 0, payloadPointer, payload.Length);
      var native = new NativeCredential
      {
        Type = CredentialTypeGeneric,
        TargetName = targetPointer,
        CredentialBlobSize = payload.Length,
        CredentialBlob = payloadPointer,
        Persist = CredentialPersistLocalMachine,
        UserName = userPointer,
      };

      if (!CredWrite(ref native, 0))
      {
        var error = Marshal.GetLastWin32Error();
        throw new Win32Exception(error, "Unable to save Bridge credential.");
      }
    }
    finally
    {
      CryptographicOperations.ZeroMemory(payload);
      Marshal.Copy(new byte[payload.Length], 0, payloadPointer, payload.Length);
      Marshal.FreeHGlobal(payloadPointer);
      Marshal.FreeCoTaskMem(userPointer);
      Marshal.FreeCoTaskMem(targetPointer);
    }
  }

  private static void EnsureWindows()
  {
    if (!OperatingSystem.IsWindows())
    {
      throw new PlatformNotSupportedException(
        "Windows Credential Manager requires Windows.");
    }
  }

  [DllImport(
    "Advapi32.dll",
    EntryPoint = "CredDeleteW",
    CharSet = CharSet.Unicode,
    SetLastError = true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  private static extern bool CredDelete(
    string target,
    int type,
    int flags);

  [DllImport(
    "Advapi32.dll",
    EntryPoint = "CredReadW",
    CharSet = CharSet.Unicode,
    SetLastError = true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  private static extern bool CredRead(
    string target,
    int type,
    int flags,
    out IntPtr credential);

  [DllImport(
    "Advapi32.dll",
    EntryPoint = "CredWriteW",
    CharSet = CharSet.Unicode,
    SetLastError = true)]
  [return: MarshalAs(UnmanagedType.Bool)]
  private static extern bool CredWrite(
    ref NativeCredential credential,
    int flags);

  [DllImport("Advapi32.dll")]
  private static extern void CredFree(IntPtr buffer);

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  private struct NativeCredential
  {
    public int Flags;
    public int Type;
    public IntPtr TargetName;
    public IntPtr Comment;
    public FILETIME LastWritten;
    public int CredentialBlobSize;
    public IntPtr CredentialBlob;
    public int Persist;
    public int AttributeCount;
    public IntPtr Attributes;
    public IntPtr TargetAlias;
    public IntPtr UserName;
  }
}
