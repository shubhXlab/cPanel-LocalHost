const app = require('./app');
const config = require('./config');
const xamppService = require('./services/xamppService');

async function startServer() {
  const desiredPort = config.port;

  const server = app.listen(desiredPort, config.host, async () => {
    console.log('====================================================');
    console.log('       🚀 LOCALHOST cPANEL IS RUNNING!             ');
    console.log('====================================================');
    console.log(`Dashboard URL: http://${config.host}:${desiredPort}`);
    console.log(`Access Mode:   Direct Localhost Access (No Login Required)`);
    console.log('----------------------------------------------------');
    console.log(`XAMPP Path:    ${config.xampp.root} (${config.xampp.installed ? 'Detected ✅' : 'Not Found ⚠️'})`);
    console.log(`Web Root:      ${config.xampp.htdocs}`);
    console.log(`phpMyAdmin:    ${config.xampp.phpMyAdmin.url}`);
    console.log('====================================================');

    // Auto-start Apache + MySQL every time (always-on mode)
    try {
      console.log('Auto-starting Apache & MySQL...');
      const initStatus = await xamppService.getStatus();
      if (!initStatus.mysql.running) {
        await xamppService.startMySQL();
        console.log('MySQL started ✅');
      }
      if (!initStatus.apache.running) {
        await xamppService.startApache();
        console.log('Apache started ✅');
      }

      const status = await xamppService.getStatus();
      console.log(`MySQL Status:  ${status.mysql.running ? 'RUNNING (Port 3306) ✅' : 'STOPPED ⚠️'}`);
      console.log(`Apache Status: ${status.apache.running ? 'RUNNING (Port 80) ✅' : 'STOPPED (Click Start in cPanel) ⚠️'}`);
    } catch (e) {}
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Port ${desiredPort} in use, attempting fallback to 2082...]`);
      app.listen(2082, config.host, () => {
        console.log(`🚀 cPanel started on fallback: http://${config.host}:2082`);
      });
    } else {
      console.error('[Server Error]', err.message);
    }
  });
}

startServer();
