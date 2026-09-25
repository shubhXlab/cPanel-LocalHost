const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');

const appRoot = path.resolve(__dirname, '..');
const payloadZipPath = path.join(appRoot, 'payload.zip');
const outputExePath = path.join(appRoot, 'cPanel-Localhost.exe');
const cPanelExePath = path.join(appRoot, 'cPanel.exe');
const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';

const manifestPath = path.join(appRoot, 'launcher', 'app.manifest');
const iconPath = path.join(appRoot, 'launcher', 'cpanel.ico');
const assemblyInfoPath = path.join(appRoot, 'launcher', 'AssemblyInfo.cs');
const localXampp = path.join(appRoot, 'xampp');
const sourceXamppDir = fs.existsSync(path.join(localXampp, 'mysql')) 
  ? localXampp 
  : (process.env.XAMPP_PATH || 'C:\\xampp');

console.log('========================================================');
console.log('    Building Option B: Full Single-File All-In-One Exe  ');
console.log('========================================================');

// 0. Ensure no conflicting processes are running
console.log('[Step 0/4] Releasing process locks...');
try {
  execSync('taskkill /F /IM cPanel-Localhost.exe /IM httpd.exe 2>nul', { stdio: 'ignore' });
  try {
    execSync(`"${path.join(sourceXamppDir, 'mysql', 'bin', 'mysqladmin.exe')}" -u root shutdown`, { stdio: 'ignore', timeout: 5000 });
  } catch (e) {
    execSync('taskkill /F /IM mysqld.exe 2>nul', { stdio: 'ignore' });
  }
} catch (e) {}

// Release file lock by unlinking or renaming outputExePath if needed
try {
  if (fs.existsSync(outputExePath)) {
    try {
      fs.unlinkSync(outputExePath);
    } catch (e) {
      const tempOld = path.join(appRoot, `cPanel-Localhost.old_${Date.now()}.exe`);
      fs.renameSync(outputExePath, tempOld);
    }
  }
} catch (e) {}

// Helper to add directory recursively with filters
function addDirToArchive(archive, srcDir, destPrefix, filterFn) {
  if (!fs.existsSync(srcDir)) return;
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = destPrefix ? `${destPrefix}/${entry.name}` : entry.name;
    
    if (filterFn && !filterFn(srcPath, entry)) {
      continue;
    }

    if (entry.isDirectory()) {
      addDirToArchive(archive, srcPath, destPath, filterFn);
    } else if (entry.isFile()) {
      archive.file(srcPath, { name: destPath });
    }
  }
}

// 1. Pack full payload.zip with portable XAMPP
async function createPayload() {
  console.log('[Step 1/4] Packaging embedded payload.zip (All-In-One Stack)...');
  if (fs.existsSync(payloadZipPath)) {
    fs.unlinkSync(payloadZipPath);
  }

  const output = fs.createWriteStream(payloadZipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  const promise = new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
  });

  archive.pipe(output);

  // App core files
  archive.file(path.join(appRoot, 'package.json'), { name: 'package.json' });
  archive.file(path.join(appRoot, 'bin', 'node.exe'), { name: 'bin/node.exe' });

  console.log(' -> Adding server, client, scripts, node_modules...');
  archive.directory(path.join(appRoot, 'server'), 'server');
  archive.directory(path.join(appRoot, 'client'), 'client');
  archive.directory(path.join(appRoot, 'scripts'), 'scripts');
  archive.directory(path.join(appRoot, 'node_modules'), 'node_modules');

  // Add clean data directory structure without user-specific store/sessions
  archive.append('', { name: 'data/.gitkeep' });
  archive.append('', { name: 'data/vhosts/.gitkeep' });

  // XAMPP portable components
  console.log(` -> Packaging portable Apache from ${path.join(sourceXamppDir, 'apache')}...`);
  addDirToArchive(archive, path.join(sourceXamppDir, 'apache', 'bin'), 'xampp/apache/bin');
  addDirToArchive(archive, path.join(sourceXamppDir, 'apache', 'conf'), 'xampp/apache/conf');
  addDirToArchive(archive, path.join(sourceXamppDir, 'apache', 'modules'), 'xampp/apache/modules');
  archive.append('', { name: 'xampp/apache/logs/.gitkeep' });

  console.log(` -> Packaging portable PHP from ${path.join(sourceXamppDir, 'php')}...`);
  const phpFiles = fs.readdirSync(path.join(sourceXamppDir, 'php'), { withFileTypes: true });
  for (const f of phpFiles) {
    if (f.isFile()) {
      archive.file(path.join(sourceXamppDir, 'php', f.name), { name: `xampp/php/${f.name}` });
    }
  }
  addDirToArchive(archive, path.join(sourceXamppDir, 'php', 'ext'), 'xampp/php/ext');
  archive.append('', { name: 'xampp/php/logs/.gitkeep' });

  console.log(` -> Packaging portable MySQL from ${path.join(sourceXamppDir, 'mysql')}...`);
  const mysqlBinDir = path.join(sourceXamppDir, 'mysql', 'bin');
  const allowedExes = new Set([
    'mysqld.exe', 'mysql.exe', 'mysqladmin.exe', 'mysqldump.exe', 'mysqlcheck.exe', 'my_print_defaults.exe'
  ]);
  const mysqlBinEntries = fs.readdirSync(mysqlBinDir, { withFileTypes: true });
  for (const entry of mysqlBinEntries) {
    if (entry.isFile()) {
      const lower = entry.name.toLowerCase();
      if (lower.endsWith('.dll') || lower === 'my.ini' || allowedExes.has(lower)) {
        archive.file(path.join(mysqlBinDir, entry.name), { name: `xampp/mysql/bin/${entry.name}` });
      }
    }
  }
  addDirToArchive(archive, path.join(sourceXamppDir, 'mysql', 'share'), 'xampp/mysql/share');
  
  const mysqlDataDir = path.join(sourceXamppDir, 'mysql', 'data');
  // Only package pristine system databases - never user-created databases
  const allowedDatabases = new Set(['mysql', 'performance_schema', 'phpmyadmin']);
  const mysqlDataEntries = fs.readdirSync(mysqlDataDir, { withFileTypes: true });
  for (const entry of mysqlDataEntries) {
    const fullPath = path.join(mysqlDataDir, entry.name);
    if (entry.isDirectory()) {
      if (allowedDatabases.has(entry.name.toLowerCase())) {
        addDirToArchive(archive, fullPath, `xampp/mysql/data/${entry.name}`);
      }
    } else if (entry.isFile()) {
      const lower = entry.name.toLowerCase();
      if (lower === 'ibdata1' || lower.startsWith('aria_log') || lower === 'my.ini' || lower === 'ib_logfile0' || lower === 'ib_logfile1') {
        archive.file(fullPath, { name: `xampp/mysql/data/${entry.name}` });
      }
    }
  }

  console.log(` -> Packaging portable phpMyAdmin from ${path.join(sourceXamppDir, 'phpMyAdmin')}...`);
  addDirToArchive(archive, path.join(sourceXamppDir, 'phpMyAdmin'), 'xampp/phpMyAdmin', (srcPath) => {
    const lower = srcPath.toLowerCase();
    if (lower.includes('\\doc\\') || lower.includes('/doc/') || lower.includes('\\examples\\')) return false;
    return true;
  });
  archive.append('', { name: 'xampp/phpMyAdmin/tmp/twig/.gitkeep' });

  console.log(` -> Packaging Web Root (htdocs) from ${path.join(sourceXamppDir, 'htdocs')}...`);
  const htdocsDir = path.join(sourceXamppDir, 'htdocs');
  if (fs.existsSync(path.join(htdocsDir, 'index.php'))) {
    archive.file(path.join(htdocsDir, 'index.php'), { name: 'xampp/htdocs/index.php' });
  }
  if (fs.existsSync(path.join(htdocsDir, '.htaccess'))) {
    archive.file(path.join(htdocsDir, '.htaccess'), { name: 'xampp/htdocs/.htaccess' });
  }

  // Create empty public_html folder - do NOT include any user-created files from this PC
  console.log(' -> Packaging clean empty public_html folder inside xampp/htdocs...');
  archive.append('', { name: 'xampp/htdocs/public_html/.gitkeep' });

  archive.append('', { name: 'xampp/tmp/.gitkeep' });

  await archive.finalize();
  await promise;

  const zipStats = fs.statSync(payloadZipPath);
  console.log(`[Payload] Completed: payload.zip (${(zipStats.size / 1024 / 1024).toFixed(2)} MB)`);
}

async function main() {
  const forceRepack = process.argv.includes('--repack');
  if (!fs.existsSync(payloadZipPath) || forceRepack) {
    await createPayload();
  } else {
    const zipStats = fs.statSync(payloadZipPath);
    console.log(`[Step 1/4] Using existing payload.zip (${(zipStats.size / 1024 / 1024).toFixed(2)} MB) - use --repack to recreate.`);
  }

  // 2. Compile Release Single-File Executable
  console.log('[Step 2/4] Compiling release 64-bit cPanel-Localhost.exe with manifest & metadata...');
  const launcherSource = path.join(appRoot, 'launcher', 'SingleFileLauncher.cs');
  const certPath = path.join(appRoot, 'scripts', 'cpanel-localhost-cert.cer');
  const compileCmd = `"${cscPath}" /nologo /target:winexe /platform:x64 /out:"${outputExePath}" /win32manifest:"${manifestPath}" /win32icon:"${iconPath}" /resource:"${payloadZipPath}",payload.zip /resource:"${certPath}",cert.cer /r:System.dll /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.IO.Compression.dll /r:System.IO.Compression.FileSystem.dll "${launcherSource}" "${assemblyInfoPath}"`;

  execSync(compileCmd, { cwd: appRoot, stdio: 'inherit' });
  const exeStats = fs.statSync(outputExePath);
  console.log(`[Build] Compiled: ${(exeStats.size / 1024 / 1024).toFixed(2)} MB`);

  // Also compile cPanel.exe with manifest and metadata
  console.log('[Step 2b] Compiling release 64-bit cPanel.exe launcher...');
  const folderLauncherSource = path.join(appRoot, 'launcher', 'cPanelLauncher.cs');
  const compileFolderCmd = `"${cscPath}" /nologo /target:winexe /platform:x64 /out:"${cPanelExePath}" /win32manifest:"${manifestPath}" /win32icon:"${iconPath}" /r:System.dll /r:System.Windows.Forms.dll /r:System.Drawing.dll "${folderLauncherSource}" "${assemblyInfoPath}"`;
  execSync(compileFolderCmd, { cwd: appRoot, stdio: 'inherit' });

  // 3. Digital Code Signing (Authenticode)
  console.log('[Step 3/4] Applying Authenticode digital signature...');
  try {
    const signScript = `
      $cert = Get-Item "Cert:\\CurrentUser\\My\\FF64655A59292186DB955542DC9D1C16855442E0" -ErrorAction SilentlyContinue;
      if (-not $cert) {
        $cert = Get-Item "Cert:\\CurrentUser\\My\\DB9AA37D13EE2A44B5607FDE15B974466930D446" -ErrorAction SilentlyContinue;
      }
      if ($cert) {
        Set-AuthenticodeSignature -FilePath "${outputExePath}" -Certificate $cert | Out-Null;
        Set-AuthenticodeSignature -FilePath "${cPanelExePath}" -Certificate $cert | Out-Null;
        Write-Host "[Signature] Successfully signed cPanel-Localhost.exe and cPanel.exe with $($cert.Subject)";
      } else {
        Write-Host "[Signature] Code signing certificate not found, skipping signature.";
      }
    `;
    execSync(`powershell -Command "${signScript.replace(/\n/g, ' ')}"`, { stdio: 'inherit' });
  } catch (err) {
    console.warn('[Signature Warning]', err.message);
  }

  // 4. Deploy to Pendrive
  console.log('[Step 4/4] Deploying release binaries to pendrive...');
  const usbDrives = ['D:\\', 'D:\\cPanel-localhost'];

  for (const destDir of usbDrives) {
    if (fs.existsSync(destDir)) {
      const destFile = path.join(destDir, 'cPanel-Localhost.exe');
      fs.copyFileSync(outputExePath, destFile);
      console.log(`[USB] Copied single-file release exe to: ${destFile}`);
      
      if (destDir.includes('cPanel-localhost')) {
        fs.copyFileSync(cPanelExePath, path.join(destDir, 'cPanel.exe'));
      }
    }
  }

  console.log('========================================================');
  console.log('🎉 FULL RELEASE FINAL ALL-IN-ONE EXE READY!');
  console.log(`Executable: ${outputExePath}`);
  console.log(`File Size:  ${(exeStats.size / 1024 / 1024).toFixed(2)} MB`);
  console.log('Features:');
  console.log(' - Built-in Portable Apache HTTP Server');
  console.log(' - Built-in Portable MySQL / MariaDB Database Server');
  console.log(' - Built-in Portable PHP 8 Engine with mysqli & pdo');
  console.log(' - Built-in phpMyAdmin Database Manager');
  console.log(' - Built-in Node.js Portable Runtime');
  console.log(' - Valid Windows Application Manifest (asInvoker, Win10/11)');
  console.log(' - Embedded PE Version & Assembly Metadata');
  console.log(' - Embedded Application Icon');
  console.log(' - Authenticode Digital Signature');
  console.log(' - Visual Setup Progress Dialog (First Launch)');
  console.log('========================================================');
}

main().catch((err) => {
  console.error('[Fatal Error]', err);
  process.exit(1);
});
