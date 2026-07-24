#if WINDOWS
using System.Drawing;
using System.Windows.Forms;
using LumaRelay.PlayerBridge.Hosting;

namespace LumaRelay.PlayerBridge.Lifecycle;

internal static class WindowsBridgeRuntime
{
  private const string InstanceMutexName =
    @"Local\LumaRelay.PlayerBridge.Instance";
  private const string ShutdownEventName =
    @"Local\LumaRelay.PlayerBridge.Shutdown";

  public static int Run(string[] args)
  {
    using var instanceMutex = new Mutex(
      initiallyOwned: true,
      InstanceMutexName,
      out var isFirstInstance);

    if (!isFirstInstance)
      return 0;

    try
    {
      return RunFirstInstance(args);
    }
    finally
    {
      instanceMutex.ReleaseMutex();
    }
  }

  public static bool SignalShutdown()
  {
    try
    {
      using var shutdownEvent = EventWaitHandle.OpenExisting(
        ShutdownEventName);
      return shutdownEvent.Set();
    }
    catch (WaitHandleCannotBeOpenedException)
    {
      return false;
    }
  }

  private static int RunFirstInstance(string[] args)
  {
    using var shutdownEvent = new EventWaitHandle(
      initialState: false,
      EventResetMode.AutoReset,
      ShutdownEventName);
    var application = BridgeHost.Build(args);

    try
    {
      application.StartAsync().GetAwaiter().GetResult();
      ApplicationConfiguration.Initialize();

      using var tray = new BridgeTrayContext();
      var waitRegistration = ThreadPool.RegisterWaitForSingleObject(
        shutdownEvent,
        (_, _) => tray.RequestExit(),
        null,
        Timeout.Infinite,
        executeOnlyOnce: true);

      try
      {
        Application.Run(tray);
      }
      finally
      {
        waitRegistration.Unregister(null);
      }

      using var stopTimeout = new CancellationTokenSource(
        TimeSpan.FromSeconds(5));
      application.StopAsync(stopTimeout.Token).GetAwaiter().GetResult();
      return 0;
    }
    finally
    {
      application.DisposeAsync().AsTask().GetAwaiter().GetResult();
    }
  }

  private sealed class BridgeTrayContext : ApplicationContext
  {
    private readonly Control dispatcher;
    private readonly ContextMenuStrip menu;
    private readonly NotifyIcon notifyIcon;

    public BridgeTrayContext()
    {
      var presentation = BridgeTrayPresentation.Create();
      dispatcher = new Control();
      _ = dispatcher.Handle;

      var statusItem = new ToolStripMenuItem(presentation.StatusText)
      {
        Enabled = false,
      };
      var exitItem = new ToolStripMenuItem(presentation.ExitText);
      exitItem.Click += (_, _) => ExitThread();

      menu = new ContextMenuStrip();
      menu.Items.Add(statusItem);
      menu.Items.Add(new ToolStripSeparator());
      menu.Items.Add(exitItem);

      notifyIcon = new NotifyIcon
      {
        ContextMenuStrip = menu,
        Icon = SystemIcons.Application,
        Text = presentation.Title,
        Visible = true,
      };
    }

    public void RequestExit()
    {
      if (dispatcher.IsDisposed)
        return;

      dispatcher.BeginInvoke((Action)ExitThread);
    }

    protected override void ExitThreadCore()
    {
      notifyIcon.Visible = false;
      notifyIcon.Dispose();
      menu.Dispose();
      dispatcher.Dispose();
      base.ExitThreadCore();
    }
  }
}
#endif
