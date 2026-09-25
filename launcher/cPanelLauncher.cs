using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using System.Windows.Forms;

namespace CPanelLocalhost
{
    static class Program
    {
        private static Mutex singleInstanceMutex;
        private const string MutexName = @"Local\cPanelLocalhostLauncherMutex";

        [STAThread]
        static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            bool createdNew = true;
            try
            {
                singleInstanceMutex = new Mutex(true, MutexName, out createdNew);
            }
            catch
            {
                createdNew = true;
            }

            if (!createdNew)
            {
                // Already running - open browser and exit this instance
                try
                {
                    Process.Start(new ProcessStartInfo("http://localhost:2083") { UseShellExecute = true });
                }
                catch { }
                return;
            }

            try
            {
                Application.Run(new CPanelTrayApplicationContext());
            }
            finally
            {
                if (singleInstanceMutex != null)
                {
                    try { singleInstanceMutex.ReleaseMutex(); } catch { }
                    singleInstanceMutex.Dispose();
                }
            }
        }
    }

    public class CPanelTrayApplicationContext : ApplicationContext
    {
        private NotifyIcon trayIcon;
        private ContextMenuStrip trayMenu;
        private Process serverProcess;
        private string appDir;
        private string nodeExe;
        private string logFile;
        private bool isExiting = false;

        public CPanelTrayApplicationContext()
        {
            try
            {
                appDir = AppDomain.CurrentDomain.BaseDirectory;
                if (File.Exists(Path.Combine(appDir, "server", "server.js")))
                {
                    // appDir is already root
                }
                else if (File.Exists(Path.Combine(appDir, "..", "server", "server.js")))
                {
                    appDir = Path.GetFullPath(Path.Combine(appDir, ".."));
                }

                logFile = Path.Combine(appDir, "launcher.log");
                Log("=== cPanel.exe Launcher Starting ===");
                Log("Application Directory: " + appDir);

                nodeExe = ResolveNodeExecutable();
                Log("Resolved Node Executable: " + nodeExe);

                EnsureXamppAndPublicHtml();
                InitializeTray();
                StartServer();

                // Check when server is ready, then open browser
                ThreadPool.QueueUserWorkItem(_ => WaitForServerAndOpenBrowser());
            }
            catch (Exception ex)
            {
                Log("CRITICAL Initialization Error: " + ex.ToString());
                MessageBox.Show("Initialization Error:\n" + ex.Message, "cPanel Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void Log(string message)
        {
            try
            {
                if (!string.IsNullOrEmpty(logFile))
                {
                    File.AppendAllText(logFile, string.Format("[{0:yyyy-MM-dd HH:mm:ss}] {1}\r\n", DateTime.Now, message));
                }
            }
            catch { }
        }

        private string ResolveNodeExecutable()
        {
            // 1. Check portable bundled node in bin\node.exe
            string localBinNode = Path.Combine(appDir, "bin", "node.exe");
            if (File.Exists(localBinNode))
            {
                Log("Using bundled portable node at: " + localBinNode);
                return localBinNode;
            }

            // 2. Check portable node.exe in app root
            string rootNode = Path.Combine(appDir, "node.exe");
            if (File.Exists(rootNode))
            {
                Log("Using root node at: " + rootNode);
                return rootNode;
            }

            // 3. Standard Program Files path
            string progFilesNode = @"C:\Program Files\nodejs\node.exe";
            if (File.Exists(progFilesNode)) return progFilesNode;

            // 4. Check system PATH
            string pathEnv = Environment.GetEnvironmentVariable("PATH") ?? "";
            foreach (string p in pathEnv.Split(';'))
            {
                try
                {
                    string candidate = Path.Combine(p.Trim(), "node.exe");
                    if (!string.IsNullOrEmpty(p) && File.Exists(candidate))
                    {
                        return candidate;
                    }
                }
                catch { }
            }

            return "node.exe";
        }

        private void InitializeTray()
        {
            trayMenu = new ContextMenuStrip();
            trayMenu.RenderMode = ToolStripRenderMode.System;

            var itemOpen = new ToolStripMenuItem("🌐 Open cPanel Dashboard (Port 2083)", null, (s, e) => OpenUrl("http://localhost:2083"));
            itemOpen.Font = new Font(itemOpen.Font, FontStyle.Bold);
            trayMenu.Items.Add(itemOpen);

            trayMenu.Items.Add(new ToolStripMenuItem("🐬 Open phpMyAdmin", null, (s, e) => OpenUrl("http://localhost/phpmyadmin/")));
            trayMenu.Items.Add(new ToolStripMenuItem("📁 Open Web Root (public_html)", null, (s, e) => OpenWebRoot()));
            trayMenu.Items.Add(new ToolStripSeparator());

            trayMenu.Items.Add(new ToolStripMenuItem("⚡ Start All Services (Apache & MySQL)", null, (s, e) => StartServices()));
            trayMenu.Items.Add(new ToolStripMenuItem("⏹️ Stop All Services", null, (s, e) => StopServices()));
            trayMenu.Items.Add(new ToolStripMenuItem("🔄 Restart cPanel Server", null, (s, e) => RestartServer()));
            trayMenu.Items.Add(new ToolStripSeparator());

            var statusItem = new ToolStripMenuItem("Status: Running on http://localhost:2083");
            statusItem.Enabled = false;
            trayMenu.Items.Add(statusItem);
            trayMenu.Items.Add(new ToolStripSeparator());

            trayMenu.Items.Add(new ToolStripMenuItem("❌ Exit cPanel (Clean Shutdown)", null, (s, e) => CleanExit()));

            trayIcon = new NotifyIcon
            {
                Icon = CreateCPanelIcon(),
                ContextMenuStrip = trayMenu,
                Text = "cPanel Localhost (Running on Port 2083)",
                Visible = true
            };

            trayIcon.DoubleClick += (s, e) => OpenUrl("http://localhost:2083");
        }

        private Icon CreateCPanelIcon()
        {
            try
            {
                using (Bitmap bmp = new Bitmap(32, 32))
                using (Graphics g = Graphics.FromImage(bmp))
                {
                    g.SmoothingMode = SmoothingMode.AntiAlias;
                    g.Clear(Color.Transparent);

                    // Rounded Orange background
                    using (GraphicsPath path = new GraphicsPath())
                    {
                        int radius = 7;
                        Rectangle rect = new Rectangle(1, 1, 30, 30);
                        path.AddArc(rect.X, rect.Y, radius * 2, radius * 2, 180, 90);
                        path.AddArc(rect.Right - radius * 2, rect.Y, radius * 2, radius * 2, 270, 90);
                        path.AddArc(rect.Right - radius * 2, rect.Bottom - radius * 2, radius * 2, radius * 2, 0, 90);
                        path.AddArc(rect.X, rect.Bottom - radius * 2, radius * 2, radius * 2, 90, 90);
                        path.CloseFigure();

                        using (LinearGradientBrush brush = new LinearGradientBrush(rect, Color.FromArgb(255, 108, 44), Color.FromArgb(224, 85, 23), 45f))
                        {
                            g.FillPath(brush, path);
                        }
                    }

                    // Draw "cP" text in white bold
                    using (Font font = new Font("Arial", 13, FontStyle.Bold, GraphicsUnit.Pixel))
                    using (SolidBrush textBrush = new SolidBrush(Color.White))
                    {
                        StringFormat sf = new StringFormat
                        {
                            Alignment = StringAlignment.Center,
                            LineAlignment = StringAlignment.Center
                        };
                        g.DrawString("cP", font, textBrush, new RectangleF(0, 0, 32, 32), sf);
                    }

                    IntPtr hIcon = bmp.GetHicon();
                    return Icon.FromHandle(hIcon);
                }
            }
            catch
            {
                return SystemIcons.Application;
            }
        }

        private void StartServer()
        {
            try
            {
                string serverScript = Path.Combine(appDir, "server", "server.js");
                if (!File.Exists(serverScript))
                {
                    Log("ERROR: Server script not found at: " + serverScript);
                    MessageBox.Show("Could not find server script at:\n" + serverScript, "cPanel Launch Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    return;
                }

                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = nodeExe,
                    Arguments = "\"" + serverScript + "\" --autostart",
                    WorkingDirectory = appDir,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden
                };
                psi.EnvironmentVariables["AUTO_START_SERVICES"] = "true";

                Log("Starting Node server process: " + psi.FileName + " " + psi.Arguments);
                serverProcess = new Process { StartInfo = psi };
                serverProcess.EnableRaisingEvents = true;
                serverProcess.Exited += (s, e) =>
                {
                    Log("Node server process exited with code: " + (serverProcess != null ? serverProcess.ExitCode.ToString() : "unknown"));
                };

                serverProcess.Start();
                Log("Node server process started successfully. PID: " + serverProcess.Id);
            }
            catch (Exception ex)
            {
                Log("Failed to start cPanel server: " + ex.ToString());
                MessageBox.Show("Failed to start cPanel server:\n" + ex.Message, "cPanel Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }

        private void WaitForServerAndOpenBrowser()
        {
            bool ready = false;
            for (int i = 0; i < 20; i++)
            {
                Thread.Sleep(500);
                if (IsPortListening(2083))
                {
                    ready = true;
                    break;
                }
            }

            if (ready)
            {
                Log("Server responded on port 2083! Opening browser.");
                try
                {
                    trayIcon.ShowBalloonTip(3000, "cPanel Localhost Online", "cPanel server and XAMPP services are running smoothly.\nDouble-click the tray icon to open.", ToolTipIcon.Info);
                    OpenUrl("http://localhost:2083");
                }
                catch { }
            }
            else
            {
                Log("Warning: Server did not respond on port 2083 within 10 seconds.");
            }
        }

        private bool IsPortListening(int port)
        {
            try
            {
                using (TcpClient client = new TcpClient())
                {
                    IAsyncResult ar = client.BeginConnect("127.0.0.1", port, null, null);
                    bool success = ar.AsyncWaitHandle.WaitOne(400);
                    if (success)
                    {
                        client.EndConnect(ar);
                        return true;
                    }
                }
            }
            catch { }
            return false;
        }

        private void OpenUrl(string url)
        {
            try
            {
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
            }
            catch { }
        }

        private void OpenWebRoot()
        {
            try
            {
                string publicHtml = @"C:\xampp\htdocs\public_html";
                string portableHtdocs = Path.Combine(appDir, "xampp", "htdocs", "public_html");
                if (Directory.Exists(portableHtdocs)) publicHtml = portableHtdocs;
                else if (!Directory.Exists(publicHtml)) publicHtml = @"C:\xampp\htdocs";

                Process.Start(new ProcessStartInfo("explorer.exe", "\"" + publicHtml + "\"") { UseShellExecute = true });
            }
            catch { }
        }

        private void EnsureXamppAndPublicHtml()
        {
            try
            {
                // Check if xampp exists in appDir or C:\xampp, if not create that and then public_html
                string portableXampp = Path.Combine(appDir, "xampp");
                if (Directory.Exists(portableXampp))
                {
                    string htdocs = Path.Combine(portableXampp, "htdocs");
                    if (!Directory.Exists(htdocs)) Directory.CreateDirectory(htdocs);
                    string publicHtml = Path.Combine(htdocs, "public_html");
                    if (!Directory.Exists(publicHtml)) Directory.CreateDirectory(publicHtml);
                    Log("Verified portable xampp/htdocs/public_html exists: " + publicHtml);
                }

                if (Directory.Exists(@"C:\xampp"))
                {
                    string extHtdocs = @"C:\xampp\htdocs";
                    if (!Directory.Exists(extHtdocs)) Directory.CreateDirectory(extHtdocs);
                    string extPublicHtml = Path.Combine(extHtdocs, "public_html");
                    if (!Directory.Exists(extPublicHtml)) Directory.CreateDirectory(extPublicHtml);
                    Log("Verified C:\\xampp\\htdocs\\public_html exists: " + extPublicHtml);
                }
                else if (!Directory.Exists(portableXampp))
                {
                    // Neither exists: create portable xampp structure
                    Directory.CreateDirectory(portableXampp);
                    string htdocs = Path.Combine(portableXampp, "htdocs");
                    Directory.CreateDirectory(htdocs);
                    string publicHtml = Path.Combine(htdocs, "public_html");
                    Directory.CreateDirectory(publicHtml);
                    Log("Created portable xampp/htdocs/public_html: " + publicHtml);
                }
            }
            catch (Exception ex)
            {
                Log("EnsureXamppAndPublicHtml notice: " + ex.Message);
            }
        }

        private void StartServices()
        {
            ThreadPool.QueueUserWorkItem(_ =>
            {
                try
                {
                    HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://localhost:2083/api/xampp/mysql/start");
                    req.Method = "POST";
                    req.ContentType = "application/json";
                    req.ContentLength = 0;
                    req.Timeout = 5000;
                    using (req.GetResponse()) { }

                    HttpWebRequest req2 = (HttpWebRequest)WebRequest.Create("http://localhost:2083/api/xampp/apache/start");
                    req2.Method = "POST";
                    req2.ContentType = "application/json";
                    req2.ContentLength = 0;
                    req2.Timeout = 5000;
                    using (req2.GetResponse()) { }

                    trayIcon.ShowBalloonTip(2000, "Services Started", "Apache and MySQL services are active.", ToolTipIcon.Info);
                }
                catch (Exception ex)
                {
                    trayIcon.ShowBalloonTip(3000, "Services Status", "Could not start services via API: " + ex.Message, ToolTipIcon.Warning);
                }
            });
        }

        private void StopServices()
        {
            ThreadPool.QueueUserWorkItem(_ =>
            {
                try
                {
                    HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://localhost:2083/api/xampp/apache/stop");
                    req.Method = "POST";
                    req.ContentType = "application/json";
                    req.ContentLength = 0;
                    req.Timeout = 5000;
                    using (req.GetResponse()) { }

                    HttpWebRequest req2 = (HttpWebRequest)WebRequest.Create("http://localhost:2083/api/xampp/mysql/stop");
                    req2.Method = "POST";
                    req2.ContentType = "application/json";
                    req2.ContentLength = 0;
                    req2.Timeout = 5000;
                    using (req2.GetResponse()) { }

                    trayIcon.ShowBalloonTip(2000, "Services Stopped", "Apache and MySQL services have been stopped.", ToolTipIcon.Info);
                }
                catch { }
            });
        }

        private void RestartServer()
        {
            try
            {
                if (serverProcess != null && !serverProcess.HasExited)
                {
                    serverProcess.Kill();
                }
            }
            catch { }

            Thread.Sleep(1000);
            StartServer();
            trayIcon.ShowBalloonTip(2000, "cPanel Restarted", "Localhost cPanel server restarted.", ToolTipIcon.Info);
        }

        private void CleanExit()
        {
            isExiting = true;
            trayIcon.Visible = false;

            // Kill Node server
            try
            {
                if (serverProcess != null && !serverProcess.HasExited)
                {
                    serverProcess.Kill();
                }
            }
            catch { }

            // Stop background Apache and MySQL gracefully
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = "/c taskkill /F /IM httpd.exe & taskkill /F /IM mysqld.exe",
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden,
                    UseShellExecute = false
                };
                using (Process p = Process.Start(psi))
                {
                    p.WaitForExit(3000);
                }
            }
            catch { }

            Application.Exit();
        }
    }
}
