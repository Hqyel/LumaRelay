using System.Diagnostics;
using System.Runtime.Versioning;
using Microsoft.Win32;

namespace NewEmby.PlayerBridge.Players;

internal sealed class WindowsPotPlayerEnvironment : IPotPlayerEnvironment
{
  private const int ProcessPriority = 0;
  private const int AppPathsPriority = 10;
  private const int VendorRegistryPriority = 20;
  private const int StandardPathPriority = 30;

  private static readonly string[] ExecutableNames =
  [
    "PotPlayerMini64.exe",
    "PotPlayerMini.exe",
    "PotPlayer64.exe",
    "PotPlayer.exe",
  ];

  public IReadOnlyList<PlayerPathCandidate> GetCandidates()
  {
    if (!OperatingSystem.IsWindows())
      return [];

    var candidates = new List<PlayerPathCandidate>();
    AddProcessCandidates(candidates);
    AddAppPathCandidates(candidates);
    AddVendorRegistryCandidates(candidates);
    AddStandardPathCandidates(candidates);
    return candidates;
  }

  public bool FileExists(string path)
  {
    return File.Exists(path);
  }

  public string? ReadFileVersion(string path)
  {
    try
    {
      return FileVersionInfo.GetVersionInfo(path).FileVersion;
    }
    catch (Exception exception) when (
      exception is FileNotFoundException
        or UnauthorizedAccessException
        or IOException)
    {
      return null;
    }
  }

  private static void AddProcessCandidates(
    List<PlayerPathCandidate> candidates)
  {
    foreach (var process in Process.GetProcesses())
    {
      using (process)
      {
        try
        {
          if (!ExecutableNames.Any(name =>
            string.Equals(
              Path.GetFileNameWithoutExtension(name),
              process.ProcessName,
              StringComparison.OrdinalIgnoreCase)))
          {
            continue;
          }

          var path = process.MainModule?.FileName;
          if (!string.IsNullOrWhiteSpace(path))
          {
            candidates.Add(new PlayerPathCandidate(
              path,
              true,
              ProcessPriority));
          }
        }
        catch (Exception exception) when (
          exception is InvalidOperationException
            or System.ComponentModel.Win32Exception
            or NotSupportedException)
        {
          // A protected or exiting process must not break Bridge status.
        }
      }
    }
  }

  [SupportedOSPlatform("windows")]
  private static void AddAppPathCandidates(
    List<PlayerPathCandidate> candidates)
  {
    foreach (var hive in GetRegistryHives())
    {
      foreach (var name in ExecutableNames)
      {
        var subkey = string.Concat(
          @"Software\Microsoft\Windows\CurrentVersion\App Paths\",
          name);
        AddRegistryValue(
          candidates,
          hive.Hive,
          hive.View,
          subkey,
          null,
          name,
          AppPathsPriority);
        AddRegistryValue(
          candidates,
          hive.Hive,
          hive.View,
          subkey,
          "Path",
          name,
          AppPathsPriority);
      }
    }
  }

  [SupportedOSPlatform("windows")]
  private static void AddVendorRegistryCandidates(
    List<PlayerPathCandidate> candidates)
  {
    var subkeys = new[]
    {
      @"Software\DAUM\PotPlayer64",
      @"Software\DAUM\PotPlayer",
    };
    var valueNames = new[] { "ProgramPath", "Path" };

    foreach (var hive in GetRegistryHives())
    {
      foreach (var subkey in subkeys)
      {
        foreach (var valueName in valueNames)
        {
          foreach (var executableName in ExecutableNames)
          {
            AddRegistryValue(
              candidates,
              hive.Hive,
              hive.View,
              subkey,
              valueName,
              executableName,
              VendorRegistryPriority);
          }
        }
      }
    }
  }

  [SupportedOSPlatform("windows")]
  private static void AddRegistryValue(
    List<PlayerPathCandidate> candidates,
    RegistryHive hive,
    RegistryView view,
    string subkey,
    string? valueName,
    string executableName,
    int priority)
  {
    try
    {
      using var baseKey = RegistryKey.OpenBaseKey(hive, view);
      using var key = baseKey.OpenSubKey(subkey, writable: false);
      var value = key?.GetValue(valueName) as string;
      if (string.IsNullOrWhiteSpace(value))
        return;

      var path = value.Trim().Trim('"');
      if (!Path.HasExtension(path))
        path = Path.Combine(path, executableName);

      candidates.Add(new PlayerPathCandidate(path, false, priority));
    }
    catch (Exception exception) when (
      exception is UnauthorizedAccessException
        or IOException
        or System.Security.SecurityException
        or ArgumentException)
    {
      // Registry discovery is best effort and never blocks Bridge startup.
    }
  }

  private static void AddStandardPathCandidates(
    List<PlayerPathCandidate> candidates)
  {
    var roots = new[]
    {
      Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
      Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
      Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
    };

    foreach (var root in roots.Where(root =>
      !string.IsNullOrWhiteSpace(root)))
    {
      foreach (var name in ExecutableNames)
      {
        candidates.Add(new PlayerPathCandidate(
          Path.Combine(root, "DAUM", "PotPlayer", name),
          false,
          StandardPathPriority));
        candidates.Add(new PlayerPathCandidate(
          Path.Combine(root, "Programs", "PotPlayer", name),
          false,
          StandardPathPriority));
      }
    }
  }

  [SupportedOSPlatform("windows")]
  private static IReadOnlyList<RegistryLocation> GetRegistryHives()
  {
    return
    [
      new RegistryLocation(RegistryHive.CurrentUser, RegistryView.Registry64),
      new RegistryLocation(RegistryHive.CurrentUser, RegistryView.Registry32),
      new RegistryLocation(RegistryHive.LocalMachine, RegistryView.Registry64),
      new RegistryLocation(RegistryHive.LocalMachine, RegistryView.Registry32),
    ];
  }

  private sealed record RegistryLocation(
    RegistryHive Hive,
    RegistryView View);
}
