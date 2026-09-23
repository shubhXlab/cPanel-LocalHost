const fs = require('fs');
const path = require('path');

// Auto-detect standard or bundled portable XAMPP paths on Windows
function detectXamppPath() {
  const possiblePaths = [
    path.resolve(__dirname, '../../xampp'),                  // Bundled portable xampp in app root
    path.resolve(process.cwd(), 'xampp'),                    // Relative to cwd
    path.resolve(path.dirname(process.execPath), 'xampp'),   // Next to launcher executable
    process.env.XAMPP_PATH,
    'C:\\xampp',
    'D:\\xampp',
    'E:\\xampp',
    'C:\\xampp-portable'
  ].filter(Boolean);

  for (const candidate of possiblePaths) {
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'mysql'))) {
      return candidate;
    }
  }
  return 'C:\\xampp'; // Default fallback
}

// Automatically patch portable Apache, MySQL, and PHP paths to current location
function relocateXamppPaths(root) {
  if (!fs.existsSync(root) || root.toLowerCase() === 'c:\\xampp') return;

  const forwardRoot = root.replace(/\\/g, '/');
  const backRoot = root.replace(/\//g, '\\');

  // Ensure essential directories exist
  const dirsToEnsure = [
    path.join(root, 'tmp'),
    path.join(root, 'apache', 'logs'),
    path.join(root, 'php', 'logs'),
    path.join(root, 'mysql', 'data')
  ];
  for (const d of dirsToEnsure) {
    if (!fs.existsSync(d)) {
      try { fs.mkdirSync(d, { recursive: true }); } catch (e) {}
    }
  }

  // 1. Apache httpd.conf
  const httpdConf = path.join(root, 'apache', 'conf', 'httpd.conf');
  if (fs.existsSync(httpdConf)) {
    try {
      let content = fs.readFileSync(httpdConf, 'utf8');
      content = content.replace(/Define SRVROOT ".*?"/g, `Define SRVROOT "${forwardRoot}/apache"`);
      content = content.replace(/ServerRoot ".*?"/g, `ServerRoot "${forwardRoot}/apache"`);
      content = content.replace(/DocumentRoot ".*?"/g, `DocumentRoot "${forwardRoot}/htdocs"`);
      content = content.replace(/<Directory ".*?htdocs">/g, `<Directory "${forwardRoot}/htdocs">`);
      content = content.replace(/<Directory ".*?htdocs\/public_html">/g, `<Directory "${forwardRoot}/htdocs/public_html">`);
      content = content.replace(/ScriptAlias \/cgi-bin\/ ".*?"/g, `ScriptAlias /cgi-bin/ "${forwardRoot}/cgi-bin/"`);
      content = content.replace(/<Directory ".*?cgi-bin">/g, `<Directory "${forwardRoot}/cgi-bin">`);
      fs.writeFileSync(httpdConf, content, 'utf8');
    } catch (e) {}
  }

  // 2. Apache httpd-xampp.conf
  const xamppConf = path.join(root, 'apache', 'conf', 'extra', 'httpd-xampp.conf');
  if (fs.existsSync(xamppConf)) {
    try {
      let content = fs.readFileSync(xamppConf, 'utf8');
      content = content.replace(/SetEnv MIBDIRS ".*?"/gi, `SetEnv MIBDIRS "${forwardRoot}/php/extras/mibs"`);
      content = content.replace(/SetEnv MYSQL_HOME ".*?"/gi, `SetEnv MYSQL_HOME "${forwardRoot}/mysql/bin"`);
      content = content.replace(/SetEnv OPENSSL_CONF ".*?"/gi, `SetEnv OPENSSL_CONF "${forwardRoot}/apache/bin/openssl.cnf"`);
      content = content.replace(/SetEnv PHP_PEAR_SYSCONF_DIR ".*?"/gi, `SetEnv PHP_PEAR_SYSCONF_DIR "${forwardRoot}/php"`);
      content = content.replace(/SetEnv PHPRC ".*?"/gi, `SetEnv PHPRC "${forwardRoot}/php"`);
      content = content.replace(/SetEnv TMP ".*?"/gi, `SetEnv TMP "${forwardRoot}/tmp"`);

      content = content.replace(/LoadFile ".*?php8ts\.dll"/gi, `LoadFile "${forwardRoot}/php/php8ts.dll"`);
      content = content.replace(/LoadFile ".*?libpq\.dll"/gi, `LoadFile "${forwardRoot}/php/libpq.dll"`);
      content = content.replace(/LoadFile ".*?libsqlite3\.dll"/gi, `LoadFile "${forwardRoot}/php/libsqlite3.dll"`);
      content = content.replace(/LoadModule php_module ".*?php8apache2_4\.dll"/gi, `LoadModule php_module "${forwardRoot}/php/php8apache2_4.dll"`);
      content = content.replace(/PHPINIDir ".*?"/gi, `PHPINIDir "${forwardRoot}/php"`);
      content = content.replace(/ScriptAlias \/php-cgi\/ ".*?"/gi, `ScriptAlias /php-cgi/ "${forwardRoot}/php/"`);
      content = content.replace(/<Directory ".*?php">/gi, `<Directory "${forwardRoot}/php">`);
      content = content.replace(/<Directory ".*?htdocs\/xampp">/gi, `<Directory "${forwardRoot}/htdocs/xampp">`);

      content = content.replace(/Alias \/licenses ".*?"/gi, `Alias /licenses "${forwardRoot}/licenses/"`);
      content = content.replace(/<Directory ".*?licenses">/gi, `<Directory "${forwardRoot}/licenses">`);
      content = content.replace(/Alias \/phpmyadmin ".*?"/gi, `Alias /phpmyadmin "${forwardRoot}/phpMyAdmin/"`);
      content = content.replace(/<Directory ".*?phpMyAdmin">/gi, `<Directory "${forwardRoot}/phpMyAdmin">`);
      content = content.replace(/Alias \/webalizer ".*?"/gi, `Alias /webalizer "${forwardRoot}/webalizer/"`);
      content = content.replace(/<Directory ".*?webalizer">/gi, `<Directory "${forwardRoot}/webalizer">`);
      content = content.replace(/Require local/gi, 'Require all granted');
      fs.writeFileSync(xamppConf, content, 'utf8');
    } catch (e) {}
  }

  // 2b. Apache httpd-ssl.conf
  const sslConf = path.join(root, 'apache', 'conf', 'extra', 'httpd-ssl.conf');
  if (fs.existsSync(sslConf)) {
    try {
      let content = fs.readFileSync(sslConf, 'utf8');
      content = content.replace(/SSLSessionCache "shmcb:.*?"/gi, `SSLSessionCache "shmcb:${forwardRoot}/apache/logs/ssl_scache(512000)"`);
      content = content.replace(/DocumentRoot ".*?"/gi, `DocumentRoot "${forwardRoot}/htdocs"`);
      content = content.replace(/ErrorLog ".*?"/gi, `ErrorLog "${forwardRoot}/apache/logs/error.log"`);
      content = content.replace(/TransferLog ".*?"/gi, `TransferLog "${forwardRoot}/apache/logs/access.log"`);
      content = content.replace(/CustomLog ".*?ssl_request\.log"/gi, `CustomLog "${forwardRoot}/apache/logs/ssl_request.log"`);
      fs.writeFileSync(sslConf, content, 'utf8');
    } catch (e) {}
  }

  // 2c. Apache httpd-vhosts.conf
  const vhostsConf = path.join(root, 'apache', 'conf', 'extra', 'httpd-vhosts.conf');
  if (fs.existsSync(vhostsConf)) {
    try {
      let content = fs.readFileSync(vhostsConf, 'utf8');
      content = content.replace(/DocumentRoot ".*?public_html"/gi, `DocumentRoot "${forwardRoot}/htdocs/public_html"`);
      content = content.replace(/<Directory ".*?public_html">/gi, `<Directory "${forwardRoot}/htdocs/public_html">`);
      fs.writeFileSync(vhostsConf, content, 'utf8');
    } catch (e) {}
  }

  // 2d. General fallback: patch any remaining legacy C:/xampp paths in all .conf files
  const apacheConfDir = path.join(root, 'apache', 'conf');
  function patchConfDir(dir) {
    if (!fs.existsSync(dir)) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          patchConfDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.conf')) {
          try {
            let conf = fs.readFileSync(fullPath, 'utf8');
            const original = conf;
            conf = conf.replace(/[a-zA-Z]:[\\/]xampp(?=[\\/"'\s]|$)/gi, forwardRoot);
            conf = conf.replace(/\\xampp\\/gi, `${forwardRoot}/`);
            if (conf !== original) {
              fs.writeFileSync(fullPath, conf, 'utf8');
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
  }
  patchConfDir(apacheConfDir);

  // 3. MySQL my.ini
  const myIni = path.join(root, 'mysql', 'bin', 'my.ini');
  if (fs.existsSync(myIni)) {
    try {
      let content = fs.readFileSync(myIni, 'utf8');
      content = content.replace(/basedir\s*=\s*".*?"/gi, `basedir="${forwardRoot}/mysql"`);
      content = content.replace(/tmpdir\s*=\s*".*?"/gi, `tmpdir="${forwardRoot}/tmp"`);
      content = content.replace(/datadir\s*=\s*".*?"/gi, `datadir="${forwardRoot}/mysql/data"`);
      content = content.replace(/plugin_dir\s*=\s*".*?"/gi, `plugin_dir="${forwardRoot}/mysql/lib/plugin"`);
      content = content.replace(/socket\s*=\s*".*?"/gi, `socket="${forwardRoot}/mysql/mysql.sock"`);
      content = content.replace(/innodb_data_home_dir\s*=\s*".*?"/gi, `innodb_data_home_dir="${forwardRoot}/mysql/data"`);
      content = content.replace(/innodb_log_group_home_dir\s*=\s*".*?"/gi, `innodb_log_group_home_dir="${forwardRoot}/mysql/data"`);
      fs.writeFileSync(myIni, content, 'utf8');
    } catch (e) {}
  }

  // 3b. MySQL data my.ini
  const dataIni = path.join(root, 'mysql', 'data', 'my.ini');
  if (fs.existsSync(dataIni)) {
    try {
      let content = fs.readFileSync(dataIni, 'utf8');
      content = content.replace(/datadir\s*=\s*.*/gi, `datadir=${forwardRoot}/mysql/data`);
      fs.writeFileSync(dataIni, content, 'utf8');
    } catch (e) {}
  }

  // 4. PHP php.ini
  const phpIni = path.join(root, 'php', 'php.ini');
  if (fs.existsSync(phpIni)) {
    try {
      let content = fs.readFileSync(phpIni, 'utf8');
      content = content.replace(/extension_dir\s*=\s*".*?"/gi, `extension_dir="${backRoot}\\php\\ext"`);
      content = content.replace(/upload_tmp_dir\s*=\s*".*?"/gi, `upload_tmp_dir="${backRoot}\\tmp"`);
      content = content.replace(/session\.save_path\s*=\s*".*?"/gi, `session.save_path="${backRoot}\\tmp"`);
      content = content.replace(/^;?\s*browscap\s*=\s*".*?"/gmi, `;browscap="${backRoot}\\php\\extras\\browscap.ini"`);
      content = content.replace(/^;?\s*curl\.cainfo\s*=\s*".*?"/gmi, `curl.cainfo="${backRoot}\\apache\\bin\\curl-ca-bundle.crt"`);
      content = content.replace(/^;?\s*openssl\.cafile\s*=\s*".*?"/gmi, `openssl.cafile="${backRoot}\\apache\\bin\\curl-ca-bundle.crt"`);
      content = content.replace(/^;?\s*error_log\s*=\s*".*?"/gmi, `error_log="${backRoot}\\php\\logs\\php_error_log"`);
      content = content.replace(/^;?\s*include_path\s*=.*xampp.*/gmi, `include_path=".;${backRoot}\\php\\PEAR"`);
      fs.writeFileSync(phpIni, content, 'utf8');
    } catch (e) {}
  }

  // 5. phpMyAdmin cache directory and warning suppression
  const pmaTmp = path.join(root, 'phpMyAdmin', 'tmp');
  const pmaTwig = path.join(pmaTmp, 'twig');
  try {
    if (!fs.existsSync(pmaTwig)) {
      fs.mkdirSync(pmaTwig, { recursive: true });
    }
  } catch (e) {}

  const pmaConfig = path.join(root, 'phpMyAdmin', 'config.inc.php');
  if (fs.existsSync(pmaConfig)) {
    try {
      let content = fs.readFileSync(pmaConfig, 'utf8');
      content = content.replace(/\$cfg\['PmaNoRelation_DisableWarning'\]\s*=\s*false;/g, "$cfg['PmaNoRelation_DisableWarning'] = true;");
      fs.writeFileSync(pmaConfig, content, 'utf8');
    } catch (e) {}
  }
}

const xamppRoot = detectXamppPath();
relocateXamppPaths(xamppRoot);

const xamppConfig = {
  root: xamppRoot,
  installed: fs.existsSync(xamppRoot),
  
  // MySQL binaries and paths
  mysql: {
    dir: path.join(xamppRoot, 'mysql'),
    binDir: path.join(xamppRoot, 'mysql', 'bin'),
    daemonExe: path.join(xamppRoot, 'mysql', 'bin', 'mysqld.exe'),
    cliExe: path.join(xamppRoot, 'mysql', 'bin', 'mysql.exe'),
    adminExe: path.join(xamppRoot, 'mysql', 'bin', 'mysqladmin.exe'),
    dumpExe: path.join(xamppRoot, 'mysql', 'bin', 'mysqldump.exe'),
    iniFile: path.join(xamppRoot, 'mysql', 'bin', 'my.ini'),
    dataDir: path.join(xamppRoot, 'mysql', 'data'),
    errorLog: path.join(xamppRoot, 'mysql', 'data', 'mysql_error.log'),
    port: parseInt(process.env.MYSQL_PORT || '3306', 10),
    host: process.env.MYSQL_HOST || '127.0.0.1',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || ''
  },

  // Apache binaries and paths
  apache: {
    dir: path.join(xamppRoot, 'apache'),
    binDir: path.join(xamppRoot, 'apache', 'bin'),
    exe: path.join(xamppRoot, 'apache', 'bin', 'httpd.exe'),
    confFile: path.join(xamppRoot, 'apache', 'conf', 'httpd.conf'),
    vhostsConf: path.join(xamppRoot, 'apache', 'conf', 'extra', 'httpd-vhosts.conf'),
    logsDir: path.join(xamppRoot, 'apache', 'logs'),
    errorLog: path.join(xamppRoot, 'apache', 'logs', 'error.log'),
    accessLog: path.join(xamppRoot, 'apache', 'logs', 'access.log'),
    port: parseInt(process.env.APACHE_PORT || '80', 10)
  },

  // PHP binaries and paths
  php: {
    dir: path.join(xamppRoot, 'php'),
    exe: path.join(xamppRoot, 'php', 'php.exe'),
    iniFile: path.join(xamppRoot, 'php', 'php.ini')
  },

  // Web root (htdocs)
  htdocs: path.join(xamppRoot, 'htdocs'),

  // phpMyAdmin path
  phpMyAdmin: {
    dir: path.join(xamppRoot, 'phpMyAdmin'),
    url: `http://localhost:${process.env.APACHE_PORT || '80'}/phpmyadmin/`
  }
};

module.exports = xamppConfig;
module.exports.relocateXamppPaths = relocateXamppPaths;
module.exports.detectXamppPath = detectXamppPath;
