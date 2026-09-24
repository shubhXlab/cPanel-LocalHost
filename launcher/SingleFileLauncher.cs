using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Net.Sockets;
using System.Reflection;
using System.Security.Cryptography.X509Certificates;
using System.Security.Principal;
using System.Threading;
using System.Windows.Forms;

namespace CPanelLocalhost
{
    static class Program
    {
        private static Mutex singleInstanceMutex;
        private const string MutexName = @"Local\cPanelLocalhostSingleExeMutex";

        [STAThread]
        static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            // Self-elevate to Administrator if not already running elevated
            if (!IsAdministrator())
            {
                try
                {
                    ProcessStartInfo psi = new ProcessStartInfo
                    {
                        FileName = Assembly.GetExecutingAssembly().Location,
                        UseShellExecute = true,
                        Verb = "runas"
                    };
                    Process.Start(psi);
                    return;
                }
                catch { }
            }

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
                try
                {
                    Process.Start(new ProcessStartInfo("http://localhost:2083") { UseShellExecute = true });
                }
                catch { }
                return;
            }

            try
            {
                Application.Run(new SingleFileTrayApplicationContext());
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

        private static bool IsAdministrator()
        {
            try
            {
                using (WindowsIdentity identity = WindowsIdentity.GetCurrent())
                {
                    WindowsPrincipal principal = new WindowsPrincipal(identity);
                    return principal.IsInRole(WindowsBuiltInRole.Administrator);
                }
            }
            catch
            {
                return false;
            }
        }
    }

    public class SetupSplashForm : Form
    {
        private ProgressBar progressBar;
        private Label statusLabel;

        public SetupSplashForm()
        {
            this.Text = "cPanel Localhost Setup";
            this.Width = 460;
            this.Height = 180;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.ShowInTaskbar = true;
            this.TopMost = true;

            Label title = new Label
            {
                Text = "cPanel Localhost (All-In-One Setup)",
                Font = new Font("Segoe UI", 12, FontStyle.Bold),
                Location = new Point(20, 15),
                AutoSize = true
            };
            this.Controls.Add(title);

            statusLabel = new Label
            {
                Text = "Setting up portable web server & database (first launch)...",
                Font = new Font("Segoe UI", 9, FontStyle.Regular),
                Location = new Point(20, 48),
                AutoSize = true
            };
            this.Controls.Add(statusLabel);

            progressBar = new ProgressBar
            {
                Location = new Point(20, 80),
                Width = 405,
                Height = 22,
                Style = ProgressBarStyle.Continuous,
                Minimum = 0,
                Maximum = 100,
                Value = 0
            };
            this.Controls.Add(progressBar);
        }

        public void UpdateProgress(int percentage, string status)
        {
            if (percentage >= 0 && percentage <= 100)
            {
                progressBar.Value = percentage;
            }
            if (!string.IsNullOrEmpty(status))
            {
                statusLabel.Text = status;
            }
            statusLabel.Refresh();
            progressBar.Refresh();
        }
    }

    public class SingleFileTrayApplicationContext : ApplicationContext
    {
        private NotifyIcon trayIcon;
        private ContextMenuStrip trayMenu;
        private Process serverProcess;
        private string runtimeDir;
        private string nodeExe;
        private string logFile;
        private bool isExiting = false;

        protected override void OnMainFormClosed(object sender, EventArgs e)
        {
            // Do not exit when splash form closes! Only CleanExit() exits.
        }

        public SingleFileTrayApplicationContext()
        {
            try
            {
                // Unpack to %LOCALAPPDATA%\cPanel-Localhost
                string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
                runtimeDir = Path.Combine(localAppData, "cPanel-Localhost");
                if (!Directory.Exists(runtimeDir))
                {
                    Directory.CreateDirectory(runtimeDir);
                }

                logFile = Path.Combine(runtimeDir, "launcher.log");
                Log("=== cPanel-Localhost Single File Standalone Starting ===");
                Log("Runtime Directory: " + runtimeDir);

                // Install root SSL certificate if not already installed (all-in-one setup)
                InstallEmbeddedCertificate();

                ExtractEmbeddedPayload();

                nodeExe = Path.Combine(runtimeDir, "bin", "node.exe");
                if (!File.Exists(nodeExe))
                {
                    nodeExe = "node.exe";
                }
                Log("Using Node binary: " + nodeExe);

                InitializeTray();
                StartServer();

                ThreadPool.QueueUserWorkItem(_ => WaitForServerAndOpenBrowser());
            }
            catch (Exception ex)
            {
                Log("CRITICAL Error: " + ex.ToString());
                MessageBox.Show("Startup Error:\n" + ex.Message, "cPanel Error", MessageBoxButtons.OK, MessageBoxIcon.Error);
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

        private void ExtractEmbeddedPayload()
        {
            string serverScript = Path.Combine(runtimeDir, "server", "server.js");
            string nodePath = Path.Combine(runtimeDir, "bin", "node.exe");
            string httpdPath = Path.Combine(runtimeDir, "xampp", "apache", "bin", "httpd.exe");
            string mysqldPath = Path.Combine(runtimeDir, "xampp", "mysql", "bin", "mysqld.exe");
            string versionFile = Path.Combine(runtimeDir, "build_stamp.txt");
            string currentStamp = "";
            try { currentStamp = File.GetLastWriteTimeUtc(Assembly.GetExecutingAssembly().Location).Ticks.ToString(); } catch { }

            // If already extracted with this exact build, skip extraction
            if (File.Exists(serverScript) && File.Exists(nodePath) && File.Exists(httpdPath) && File.Exists(mysqldPath) &&
                File.Exists(versionFile) && !string.IsNullOrEmpty(currentStamp) && File.ReadAllText(versionFile).Trim() == currentStamp)
            {
                Log("Runtime files are up to date in " + runtimeDir);
                return;
            }

            SetupSplashForm splash = new SetupSplashForm();
            splash.Show();
            splash.Refresh();

            try
            {
                Log("Extracting embedded payload to " + runtimeDir + " ...");
                Assembly assembly = Assembly.GetExecutingAssembly();
                using (Stream stream = assembly.GetManifestResourceStream("payload.zip"))
                {
                    if (stream == null)
                    {
                        Log("ERROR: Embedded resource 'payload.zip' not found!");
                        throw new Exception("Embedded application payload was not found inside the executable.");
                    }

                    using (ZipArchive archive = new ZipArchive(stream, ZipArchiveMode.Read))
                    {
                        int total = archive.Entries.Count;
                        int current = 0;
                        int lastReported = -1;

                        foreach (ZipArchiveEntry entry in archive.Entries)
                        {
                            current++;
                            int percent = total > 0 ? (int)((long)current * 100 / total) : 0;
                            if (percent != lastReported && percent % 5 == 0)
                            {
                                lastReported = percent;
                                splash.UpdateProgress(percent, string.Format("Extracting files... {0}% ({1}/{2})", percent, current, total));
                            }

                            string completeFileName = Path.Combine(runtimeDir, entry.FullName.Replace('/', '\\'));
                            string directory = Path.GetDirectoryName(completeFileName);

                            if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
                            {
                                Directory.CreateDirectory(directory);
                            }

                            if (!string.IsNullOrEmpty(entry.Name))
                            {
                                // Preserve existing database store on subsequent updates
                                if (entry.FullName.StartsWith("data/") && File.Exists(completeFileName))
                                {
                                    continue;
                                }
                                if (entry.FullName.StartsWith("xampp/mysql/data/") && File.Exists(completeFileName))
                                {
                                    continue;
                                }
                                try
                                {
                                    entry.ExtractToFile(completeFileName, true);
                                }
                                catch (Exception fileEx)
                                {
                                    Log("Skip extracting " + entry.FullName + ": " + fileEx.Message);
                                }
                            }
                        }
                        splash.UpdateProgress(100, "Setup complete! Starting cPanel services...");
                    }
                }
                try { if (!string.IsNullOrEmpty(currentStamp)) File.WriteAllText(versionFile, currentStamp); } catch { }
                Log("Embedded payload extracted successfully!");
            }
            finally
            {
                splash.Close();
                splash.Dispose();
            }
        }

        private void InstallEmbeddedCertificate()
        {
            try
            {
                Assembly assembly = Assembly.GetExecutingAssembly();
                byte[] certBytes = null;

                // 1. Try reading embedded cert.cer resource
                try
                {
                    using (Stream stream = assembly.GetManifestResourceStream("cert.cer"))
                    {
                        if (stream != null)
                        {
                            certBytes = new byte[stream.Length];
                            stream.Read(certBytes, 0, certBytes.Length);
                        }
                    }
                }
                catch { }

                // 2. Fallback: check scripts\cpanel-localhost-cert.cer on disk
                if (certBytes == null || certBytes.Length == 0)
                {
                    string diskCert = Path.Combine(runtimeDir, "scripts", "cpanel-localhost-cert.cer");
                    if (File.Exists(diskCert))
                    {
                        certBytes = File.ReadAllBytes(diskCert);
                    }
                }

                if (certBytes == null || certBytes.Length == 0)
                {
                    Log("Notice: 'cert.cer' resource not found in binary, skipping cert install.");
                    return;
                }

                using (X509Certificate2 cert = new X509Certificate2(certBytes))
                {
                    string thumbprint = cert.Thumbprint;

                    // Check if certificate is already installed in Trusted Root
                    bool alreadyInstalled = false;
                    try
                    {
                        using (X509Store store = new X509Store(StoreName.Root, StoreLocation.LocalMachine))
                        {
                            store.Open(OpenFlags.ReadOnly);
                            X509Certificate2Collection found = store.Certificates.Find(X509FindType.FindByThumbprint, thumbprint, false);
                            if (found.Count > 0)
                            {
                                alreadyInstalled = true;
                            }
                            store.Close();
                        }
                    }
                    catch (Exception checkEx)
                    {
                        Log("Cert check note: " + checkEx.Message);
                    }

                    if (alreadyInstalled)
                    {
                        Log("SSL Certificate is already trusted in Root store. Skipping.");
                        return;
                    }

                    Log("Installing SSL Certificate to Trusted Root store...");
                    bool installedViaStore = false;
                    try
                    {
                        using (X509Store store = new X509Store(StoreName.Root, StoreLocation.LocalMachine))
                        {
                            store.Open(OpenFlags.ReadWrite);
                            store.Add(cert);
                            store.Close();
                            installedViaStore = true;
                        }
                    }
                    catch (Exception storeEx)
                    {
                        Log("X509Store install warning: " + storeEx.Message);
                    }

                    // Also add to TrustedPublisher
                    try
                    {
                        using (X509Store tpStore = new X509Store(StoreName.TrustedPublisher, StoreLocation.LocalMachine))
                        {
                            tpStore.Open(OpenFlags.ReadWrite);
                            tpStore.Add(cert);
                            tpStore.Close();
                        }
                    }
                    catch { }

                    // Fallback to certutil if X509Store was restricted
                    if (!installedViaStore)
                    {
                        Log("Invoking certutil fallback for certificate installation...");
                        string tempCert = Path.Combine(Path.GetTempPath(), "cpanel-localhost-cert.cer");
                        try
                        {
                            File.WriteAllBytes(tempCert, certBytes);
                            ProcessStartInfo psi = new ProcessStartInfo("certutil.exe", "-addstore -f \"ROOT\" \"" + tempCert + "\"")
                            {
                                CreateNoWindow = true,
                                UseShellExecute = false,
                                WindowStyle = ProcessWindowStyle.Hidden
                            };
                            Process proc = Process.Start(psi);
                            proc.WaitForExit(8000);
                            Log("certutil finished with exit code: " + proc.ExitCode);
                        }
                        catch (Exception certutilEx)
                        {
                            Log("certutil fallback warning: " + certutilEx.Message);
                        }
                        finally
                        {
                            try { if (File.Exists(tempCert)) File.Delete(tempCert); } catch { }
                        }
                    }

                    Log("SSL Certificate installation completed successfully.");
                }
            }
            catch (Exception ex)
            {
                Log("Notice: Certificate installation error: " + ex.Message);
            }
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
                string serverScript = Path.Combine(runtimeDir, "server", "server.js");
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
                    WorkingDirectory = runtimeDir,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden
                };
                psi.EnvironmentVariables["AUTO_START_SERVICES"] = "true";

                Log("Starting Node server: " + psi.FileName + " " + psi.Arguments);
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
            for (int i = 0; i < 25; i++)
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
                Log("Server is online on port 2083! Launching browser.");
                try
                {
                    trayIcon.ShowBalloonTip(3000, "cPanel Localhost Online", "cPanel single-file server is running smoothly.\nDouble-click the tray icon to open.", ToolTipIcon.Info);
                    OpenUrl("http://localhost:2083");
                }
                catch { }
            }
            else
            {
                Log("Warning: Server did not respond on port 2083 within 12 seconds.");
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
                string localHtdocs = Path.Combine(runtimeDir, "xampp", "htdocs", "public_html");
                if (Directory.Exists(localHtdocs)) publicHtml = localHtdocs;
                else if (!Directory.Exists(publicHtml)) publicHtml = @"C:\xampp\htdocs";

                Process.Start(new ProcessStartInfo("explorer.exe", "\"" + publicHtml + "\"") { UseShellExecute = true });
            }
            catch { }
        }

        private void StartServices()
        {
            ThreadPool.QueueUserWorkItem(_ =>
            {
                try
                {
                    // Step 1: Get CSRF token + session cookie
                    CookieContainer cookies = new CookieContainer();
                    string csrfToken = "";

                    HttpWebRequest csrfReq = (HttpWebRequest)WebRequest.Create("http://localhost:2083/api/auth/csrf-token");
                    csrfReq.CookieContainer = cookies;
                    csrfReq.Method = "GET";
                    csrfReq.Timeout = 5000;
                    using (HttpWebResponse resp = (HttpWebResponse)csrfReq.GetResponse())
                    using (StreamReader reader = new StreamReader(resp.GetResponseStream()))
                    {
                        string json = reader.ReadToEnd();
                        // Simple parse: {"csrfToken":"..."}
                        int start = json.IndexOf(":\"") + 2;
                        int end = json.IndexOf("\"}", start);
                        if (start > 1 && end > start) csrfToken = json.Substring(start, end - start);
                    }

                    // Step 2: Start MySQL
                    byte[] empty = System.Text.Encoding.UTF8.GetBytes("{}");
                    HttpWebRequest req1 = (HttpWebRequest)WebRequest.Create("http://localhost:2083/api/xampp/mysql/start");
                    req1.Method = "POST";
                    req1.ContentType = "application/json";
                    req1.ContentLength = empty.Length;
                    req1.Headers["X-CSRF-Token"] = csrfToken;
                    req1.CookieContainer = cookies;
                    req1.Timeout = 10000;
                    req1.GetRequestStream().Write(empty, 0, empty.Length);
                    using (req1.GetResponse()) { }

                    // Step 3: Start Apache
                    HttpWebRequest req2 = (HttpWebRequest)WebRequest.Create("http://localhost:2083/api/xampp/apache/start");
                    req2.Method = "POST";
                    req2.ContentType = "application/json";
                    req2.ContentLength = empty.Length;
                    req2.Headers["X-CSRF-Token"] = csrfToken;
                    req2.CookieContainer = cookies;
                    req2.Timeout = 10000;
                    req2.GetRequestStream().Write(empty, 0, empty.Length);
                    using (req2.GetResponse()) { }

                    trayIcon.ShowBalloonTip(2000, "Services Started", "Apache and MySQL services are active.", ToolTipIcon.Info);
                }
                catch (Exception ex)
                {
                    trayIcon.ShowBalloonTip(3000, "Services Status", "Could not start services: " + ex.Message, ToolTipIcon.Warning);
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

            try
            {
                if (serverProcess != null && !serverProcess.HasExited)
                {
                    serverProcess.Kill();
                }
            }
            catch { }

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
