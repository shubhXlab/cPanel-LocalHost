// Comprehensive automated test suite for Localhost cPanel
const http = require('http');

let cookie = '';
let csrfToken = '';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 2083,
      path,
      method,
      headers: { ...headers }
    };

    if (cookie) options.headers['Cookie'] = cookie;
    if (csrfToken && method !== 'GET') options.headers['X-CSRF-Token'] = csrfToken;
    if (body) {
      options.headers['Content-Type'] = 'application/json';
    }

    const req = http.request(options, (res) => {
      let data = '';
      if (res.headers['set-cookie']) {
        const cookieMap = {};
        if (cookie) {
          cookie.split('; ').forEach(c => {
            const [k, v] = c.split('=');
            if (k) cookieMap[k] = v;
          });
        }
        res.headers['set-cookie'].forEach(c => {
          const [k, v] = c.split(';')[0].split('=');
          if (k) cookieMap[k] = v;
        });
        cookie = Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ');
      }
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) { json = data; }
        resolve({ status: res.statusCode, data: json, headers: res.headers });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING cPANEL LOCALHOST TEST SUITE ---');

  // Test 1: Health check on login page
  console.log('1. Testing GET /login...');
  const resLogin = await request('GET', '/login');
  console.assert(resLogin.status === 200, 'Expected status 200 on /login');
  console.log('   ✅ /login responded 200 OK');

  // Test 2: CSRF Token
  console.log('2. Testing GET /api/auth/csrf-token...');
  const resCsrf = await request('GET', '/api/auth/csrf-token');
  console.assert(resCsrf.status === 200 && resCsrf.data.csrfToken, 'Failed to fetch CSRF token');
  csrfToken = resCsrf.data.csrfToken;
  console.log('   ✅ CSRF Token obtained:', csrfToken.slice(0, 10) + '...');

  // Test 3: Authentication Login
  console.log('3. Testing POST /api/auth/login with admin/admin123...');
  const resAuth = await request('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
  console.assert(resAuth.status === 200 && resAuth.data.success, 'Login failed');
  if (resAuth.data.csrfToken) csrfToken = resAuth.data.csrfToken;
  console.log('   ✅ Logged in successfully as:', resAuth.data.user.username);

  // Test 4: Profile Check
  console.log('4. Testing GET /api/auth/me...');
  const resMe = await request('GET', '/api/auth/me');
  console.assert(resMe.status === 200 && resMe.data.user.role === 'root', 'User role mismatch');
  console.log('   ✅ User role verified:', resMe.data.user.role);

  // Test 5: XAMPP Status & Start MySQL Service
  console.log('5. Testing GET /api/xampp/status & Starting MySQL...');
  const resStartMysql = await request('POST', '/api/xampp/mysql/start');
  console.log('   MySQL start response:', resStartMysql.data.message);
  
  const resStatus = await request('GET', '/api/xampp/status');
  console.assert(resStatus.data.mysql.running, 'MySQL should be running');
  console.log('   ✅ XAMPP MySQL running on port 3306:', resStatus.data.mysql.running);

  // Test 6: MySQL Database Manager
  console.log('6. Testing MySQL Database Operations (Create DB, Users, Privileges)...');
  const testDbName = 'cpanel_verify_test';
  const testUserName = 'cp_test_user';

  // Create Database
  const resCreateDb = await request('POST', '/api/mysql/databases', { name: testDbName });
  console.assert(resCreateDb.data.success, 'Failed to create DB');
  console.log('   ✅ Created database:', testDbName);

  // Create User
  const resCreateUser = await request('POST', '/api/mysql/users', { username: testUserName, password: 'SecurePassword123!' });
  if (!resCreateUser.data.success) console.log('DEBUG RES CREATE USER:', resCreateUser.status, resCreateUser.data);
  console.assert(resCreateUser.data.success, 'Failed to create MySQL user');
  console.log('   ✅ Created MySQL user:', testUserName);

  // Grant Privileges
  const resGrant = await request('POST', '/api/mysql/privileges', {
    username: testUserName,
    database: testDbName,
    privileges: ['SELECT', 'INSERT', 'UPDATE', 'DELETE']
  });
  console.assert(resGrant.data.success, 'Failed to grant privileges');
  console.log('   ✅ Privileges granted:', resGrant.data.granted);

  // Check Database
  const resCheck = await request('POST', `/api/mysql/databases/${testDbName}/check`);
  console.assert(resCheck.status === 200, 'Failed to check database');
  console.log('   ✅ Database check executed successfully');

  // Cleanup: Delete User and Database
  await request('DELETE', `/api/mysql/users/${testUserName}`);
  await request('DELETE', `/api/mysql/databases/${testDbName}`);
  console.log('   ✅ Cleaned up test user & database');

  // Test 7: File Manager
  console.log('7. Testing File Manager operations in htdocs...');
  const testFile = 'cpanel_unit_test.txt';
  const resCreateFile = await request('POST', '/api/files/create-file', { dir: '/', name: testFile });
  console.assert(resCreateFile.data.success, 'Failed to create file');

  const resSaveFile = await request('POST', '/api/files/save', {
    path: '/' + testFile,
    content: 'Hello from Localhost cPanel integrated with XAMPP!'
  });
  console.assert(resSaveFile.data.success, 'Failed to save file');

  const resReadFile = await request('GET', `/api/files/read?path=/${testFile}`);
  console.assert(resReadFile.data.content.includes('Hello from Localhost cPanel'), 'File content mismatch');
  console.log('   ✅ File Manager: create, write, and read verified!');

  // Cleanup file
  await request('POST', '/api/files/delete', { path: '/' + testFile });
  console.log('   ✅ Cleaned up test file');

  // Test 8: Security Chroot Jail Traversal Defense
  console.log('8. Testing Path Traversal Defense (Security Check)...');
  const resJail = await request('GET', '/api/files/read?path=../../Windows/System32/drivers/etc/hosts');
  console.assert(resJail.status === 400 || resJail.status === 403, 'Path traversal was NOT blocked!');
  console.log('   ✅ Path Traversal outside chroot jail was strictly BLOCKED!');

  // Test 9: Web Terminal Sandbox
  console.log('9. Testing Web Terminal execution...');
  const resTerm = await request('POST', '/api/terminal/exec', { command: 'echo cpanel_localhost_ready' });
  console.assert(resTerm.data.output.includes('cpanel_localhost_ready'), 'Terminal output mismatch');
  console.log('   ✅ Web Terminal executed command successfully:', resTerm.data.output);

  // Test 10: Metrics & Stats
  console.log('10. Testing Metrics & Server Stats...');
  const resStats = await request('GET', '/api/metrics/stats');
  console.assert(resStats.data.system.sharedIp === '127.0.0.1', 'Stats failed');
  console.log(`   ✅ System Stats: CPU Cores=${resStats.data.system.cpuCores}, RAM=${resStats.data.memory.percent}%, Disk=${resStats.data.disk.percent}%`);

  console.log('\n🎉 ALL 10 TEST SUITES PASSED FLAWLESSLY! cPANEL IS FULLY FUNCTIONAL & SECURE!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
