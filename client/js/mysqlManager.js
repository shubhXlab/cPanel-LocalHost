// ==========================================================================
// cPanel MySQL Databases Manager
// ==========================================================================

const mysqlManager = {
  currentDatabases: [],
  currentUsers: [],
  wizardData: {
    dbName: '',
    username: '',
    password: '',
    privileges: []
  },

  init() {
    this.setupListeners();
  },

  async open() {
    cPanelApp.openModal('modal-mysql');
    await this.loadAll();
  },

  async loadAll() {
    await this.loadDatabases();
    await this.loadUsers();
  },

  // Load Databases
  async loadDatabases() {
    const tbody = document.getElementById('mysql-dbs-tbody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Loading databases from XAMPP MySQL...</td></tr>';

    try {
      const data = await cPanelApp.api('/api/mysql/databases');
      if (!data.connected) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align:center; padding: 20px; color:#ef4444;">
              <i class="fa-solid fa-triangle-exclamation"></i> <strong>XAMPP MySQL is currently stopped.</strong><br>
              <button class="btn-primary btn-sm" style="margin-top:10px;" onclick="cPanelApp.startService('mysql')">
                <i class="fa-solid fa-play"></i> Start MySQL Service
              </button>
            </td>
          </tr>
        `;
        return;
      }

      this.currentDatabases = data.databases;
      this.renderDatabasesTable(data.databases);
      this.populateSelects();

    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" style="color:#ef4444;">Error: ${err.message}</td></tr>`;
    }
  },

  renderDatabasesTable(dbs) {
    const tbody = document.getElementById('mysql-dbs-tbody');
    if (dbs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No databases found. Create one above!</td></tr>';
      return;
    }

    tbody.innerHTML = dbs.map(db => `
      <tr>
        <td>
          <strong>${db.name}</strong>
          ${db.isSystem ? '<span class="status-dot offline" title="MySQL System Database" style="display:inline-block; margin-left:6px;"></span>' : ''}
        </td>
        <td>${db.sizeMB} MB</td>
        <td>${db.tableCount} tables</td>
        <td>
          ${db.users.length > 0 ? db.users.map(u => `
            <span class="service-badge" style="display:inline-flex; margin:2px;">
              ${u} 
              <a href="#" onclick="mysqlManager.revokeUser('${u}', '${db.name}')" title="Revoke access" style="color:#ef4444; margin-left:4px;">×</a>
            </span>
          `).join('') : '<span style="color:#94a3b8;">None</span>'}
        </td>
        <td style="text-align:right;">
          <button class="btn-secondary btn-sm" onclick="mysqlManager.checkDb('${db.name}')" title="Check Database">
            <i class="fa-solid fa-stethoscope"></i> Check
          </button>
          <button class="btn-secondary btn-sm" onclick="mysqlManager.repairDb('${db.name}')" title="Repair Database">
            <i class="fa-solid fa-wrench"></i> Repair
          </button>
          ${!db.isSystem ? `
            <button class="btn-danger btn-sm" onclick="mysqlManager.deleteDb('${db.name}')" title="Delete Database">
              <i class="fa-solid fa-trash"></i>
            </button>
          ` : ''}
        </td>
      </tr>
    `).join('');
  },

  // Load MySQL Users
  async loadUsers() {
    const tbody = document.getElementById('mysql-users-tbody');
    try {
      const data = await cPanelApp.api('/api/mysql/users');
      if (!data.connected) return;

      this.currentUsers = data.users;
      tbody.innerHTML = data.users.map(u => `
        <tr>
          <td><strong>${u.user}</strong></td>
          <td>${u.host}</td>
          <td style="text-align:right;">
            <button class="btn-secondary btn-sm" onclick="mysqlManager.promptChangePassword('${u.user}')">
              <i class="fa-solid fa-key"></i> Change Password
            </button>
            ${!u.isRoot ? `
              <button class="btn-danger btn-sm" onclick="mysqlManager.deleteUser('${u.user}')">
                <i class="fa-solid fa-trash"></i> Delete
              </button>
            ` : '<span style="color:#94a3b8; font-size:11px; padding:4px 8px;">Default Root</span>'}
          </td>
        </tr>
      `).join('');

      this.populateSelects();

    } catch (e) {}
  },

  populateSelects() {
    const userSelect = document.getElementById('select-user-to-db');
    const dbSelect = document.getElementById('select-db-for-user');

    if (userSelect) {
      userSelect.innerHTML = this.currentUsers.map(u => `<option value="${u.user}">${u.user}</option>`).join('');
    }
    if (dbSelect) {
      const userDbs = this.currentDatabases.filter(d => !d.isSystem);
      dbSelect.innerHTML = userDbs.map(d => `<option value="${d.name}">${d.name}</option>`).join('');
    }
  },

  // Create Database
  async createDb(e) {
    e.preventDefault();
    const nameInput = document.getElementById('new-db-name');
    const collationInput = document.getElementById('new-db-collation');
    const name = nameInput.value.trim();
    const collation = collationInput.value;

    if (!name) return;

    try {
      await cPanelApp.api('/api/mysql/databases', {
        method: 'POST',
        body: { name, collation }
      });
      cPanelApp.showToast(`Database "${name}" created successfully!`, 'success');
      nameInput.value = '';
      await this.loadDatabases();
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  // Delete Database
  async deleteDb(name) {
    if (!confirm(`Are you sure you want to permanently delete the database "${name}"? All tables and data will be permanently destroyed!`)) {
      return;
    }

    try {
      await cPanelApp.api(`/api/mysql/databases/${encodeURIComponent(name)}`, { method: 'DELETE' });
      cPanelApp.showToast(`Database "${name}" dropped successfully.`, 'info');
      await this.loadDatabases();
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  // Check Database
  async checkDb(name) {
    try {
      const res = await cPanelApp.api(`/api/mysql/databases/${encodeURIComponent(name)}/check`, { method: 'POST' });
      const summary = res.results.map(r => `${r.Table || ''}: ${r.Msg_text || 'OK'}`).join('\n');
      alert(`Check Database Report for "${name}":\n\n${summary}`);
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  // Repair Database
  async repairDb(name) {
    try {
      const res = await cPanelApp.api(`/api/mysql/databases/${encodeURIComponent(name)}/repair`, { method: 'POST' });
      const summary = res.results.map(r => `${r.Table || ''}: ${r.Msg_text || 'OK'}`).join('\n');
      alert(`Repair Database Report for "${name}":\n\n${summary}`);
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  // Create MySQL User
  async createUser(e) {
    e.preventDefault();
    const user = document.getElementById('new-user-name').value.trim();
    const pass = document.getElementById('new-user-pass').value;

    try {
      await cPanelApp.api('/api/mysql/users', {
        method: 'POST',
        body: { username: user, password: pass }
      });
      cPanelApp.showToast(`MySQL User "${user}" created successfully!`, 'success');
      document.getElementById('new-user-name').value = '';
      document.getElementById('new-user-pass').value = '';
      await this.loadUsers();
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  // Delete MySQL User
  async deleteUser(user) {
    if (!confirm(`Are you sure you want to delete MySQL user "${user}"?`)) return;
    try {
      await cPanelApp.api(`/api/mysql/users/${encodeURIComponent(user)}`, { method: 'DELETE' });
      cPanelApp.showToast(`MySQL User "${user}" deleted.`, 'info');
      await this.loadUsers();
      await this.loadDatabases();
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  promptChangePassword(user) {
    const newPass = prompt(`Enter new password for MySQL user "${user}":`);
    if (!newPass) return;
    cPanelApp.api(`/api/mysql/users/${encodeURIComponent(user)}/password`, {
      method: 'POST',
      body: { newPassword: newPass }
    }).then(() => {
      cPanelApp.showToast(`Password updated for user "${user}"`, 'success');
    }).catch(err => cPanelApp.showToast(err.message, 'error'));
  },

  // Open Manage Privileges Modal
  async openPrivilegesModal(e) {
    e.preventDefault();
    const user = document.getElementById('select-user-to-db').value;
    const db = document.getElementById('select-db-for-user').value;

    if (!user || !db) {
      cPanelApp.showToast('Please select both a User and a Database.', 'error');
      return;
    }

    document.getElementById('priv-target-user').textContent = user;
    document.getElementById('priv-target-db').textContent = db;

    // Fetch existing privileges
    try {
      const data = await cPanelApp.api(`/api/mysql/privileges/${encodeURIComponent(user)}/${encodeURIComponent(db)}`);
      const existing = data.privileges || [];

      // Check boxes
      const isAll = existing.includes('ALL PRIVILEGES') || existing.length >= 17;
      document.getElementById('priv-all').checked = isAll;

      document.querySelectorAll('.priv-check').forEach(cb => {
        cb.checked = isAll || existing.includes(cb.value);
      });

      cPanelApp.openModal('modal-privileges');

    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  // Save Privileges
  async savePrivileges() {
    const user = document.getElementById('priv-target-user').textContent;
    const db = document.getElementById('priv-target-db').textContent;
    const isAll = document.getElementById('priv-all').checked;

    let selectedPrivs = [];
    if (isAll) {
      selectedPrivs = ['ALL PRIVILEGES'];
    } else {
      document.querySelectorAll('.priv-check:checked').forEach(cb => {
        selectedPrivs.push(cb.value);
      });
    }

    try {
      await cPanelApp.api('/api/mysql/privileges', {
        method: 'POST',
        body: {
          username: user,
          database: db,
          privileges: selectedPrivs
        }
      });

      cPanelApp.showToast(`Privileges updated for "${user}" on "${db}"!`, 'success');
      cPanelApp.closeModal('modal-privileges');
      await this.loadDatabases();

    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  async revokeUser(user, db) {
    if (!confirm(`Revoke user "${user}" privileges from database "${db}"?`)) return;
    try {
      await cPanelApp.api('/api/mysql/privileges/revoke', {
        method: 'POST',
        body: { username: user, database: db }
      });
      cPanelApp.showToast(`User "${user}" revoked from "${db}".`, 'info');
      await this.loadDatabases();
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  // Password Generator Helper
  generatePassword() {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=';
    let pass = '';
    for (let i = 0; i < 16; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const input = document.getElementById('new-user-pass');
    if (input) {
      input.value = pass;
      input.type = 'text';
      cPanelApp.showToast('Strong 16-character password generated!', 'info');
    }
  },

  // ========================================================================
  // MySQL Database Wizard Controller (4 Guided Steps)
  // ========================================================================
  openWizard() {
    this.wizardData = {
      dbName: '',
      username: '',
      password: '',
      privileges: []
    };

    const dbInput = document.getElementById('wizard-input-dbname');
    if (dbInput) dbInput.value = '';

    const userInput = document.getElementById('wizard-input-username');
    if (userInput) userInput.value = '';

    const passInput = document.getElementById('wizard-input-password');
    if (passInput) {
      passInput.value = '';
      passInput.type = 'password';
    }

    const privAll = document.getElementById('wizard-priv-all');
    if (privAll) privAll.checked = true;

    document.querySelectorAll('.wizard-priv-check').forEach(cb => {
      cb.checked = true;
    });

    this.goToWizardStep(1);
    cPanelApp.openModal('modal-mysql-wizard');
  },

  openFromWizard() {
    cPanelApp.closeModal('modal-mysql-wizard');
    this.open();
  },

  goToWizardStep(step) {
    for (let i = 1; i <= 4; i++) {
      const ind = document.getElementById(`wizard-ind-${i}`);
      const panel = document.getElementById(`wizard-panel-${i}`);
      if (ind) {
        ind.classList.remove('active', 'completed');
        const numEl = ind.querySelector('.cp-step-num');
        if (i < step) {
          ind.classList.add('completed');
          if (numEl) numEl.innerHTML = '<i class="fa-solid fa-check"></i>';
        } else if (i === step) {
          ind.classList.add('active');
          if (numEl) numEl.textContent = i;
        } else {
          if (numEl) numEl.textContent = i;
        }
      }
      if (panel) {
        panel.style.display = (i === step) ? 'block' : 'none';
      }
    }

    if (step === 1) {
      setTimeout(() => {
        const inp = document.getElementById('wizard-input-dbname');
        if (inp) inp.focus();
      }, 100);
    } else if (step === 2) {
      setTimeout(() => {
        const inp = document.getElementById('wizard-input-username');
        if (inp) inp.focus();
      }, 100);
    }
  },

  async wizardNextStep1() {
    const dbInput = document.getElementById('wizard-input-dbname');
    const collationInput = document.getElementById('wizard-input-collation');
    const name = dbInput.value.trim();
    const collation = collationInput ? collationInput.value : 'utf8mb4_unicode_ci';

    if (!name) {
      cPanelApp.showToast('Please enter a database name.', 'error');
      return;
    }

    try {
      await cPanelApp.api('/api/mysql/databases', {
        method: 'POST',
        body: { name, collation }
      });
      this.wizardData.dbName = name;

      const disp = document.getElementById('wizard-display-dbname');
      if (disp) disp.textContent = name;

      const userInp = document.getElementById('wizard-input-username');
      if (userInp && !userInp.value) {
        userInp.value = `${name.substring(0, 10)}_user`;
      }

      const passInp = document.getElementById('wizard-input-password');
      if (passInp && !passInp.value) {
        this.wizardGeneratePassword();
      }

      cPanelApp.showToast(`Database "${name}" created!`, 'success');
      this.goToWizardStep(2);
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  wizardGeneratePassword() {
    const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*';
    let pass = '';
    for (let i = 0; i < 16; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const input = document.getElementById('wizard-input-password');
    if (input) {
      input.value = pass;
      input.type = 'text';
      cPanelApp.showToast('Strong password generated!', 'info');
    }
  },

  wizardTogglePassVisibility() {
    const input = document.getElementById('wizard-input-password');
    const btn = document.getElementById('wizard-toggle-pass-btn');
    if (input) {
      if (input.type === 'password') {
        input.type = 'text';
        if (btn) btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
      } else {
        input.type = 'password';
        if (btn) btn.innerHTML = '<i class="fa-solid fa-eye"></i>';
      }
    }
  },

  async wizardNextStep2() {
    const userInput = document.getElementById('wizard-input-username');
    const passInput = document.getElementById('wizard-input-password');
    const user = userInput.value.trim();
    const pass = passInput.value;

    if (!user) {
      cPanelApp.showToast('Please enter a username.', 'error');
      return;
    }
    if (!pass || pass.length < 5) {
      cPanelApp.showToast('Password must be at least 5 characters.', 'error');
      return;
    }

    try {
      await cPanelApp.api('/api/mysql/users', {
        method: 'POST',
        body: { username: user, password: pass }
      });

      this.wizardData.username = user;
      this.wizardData.password = pass;

      const dispUser = document.getElementById('wizard-display-priv-user');
      const dispDb = document.getElementById('wizard-display-priv-db');
      if (dispUser) dispUser.textContent = user;
      if (dispDb) dispDb.textContent = this.wizardData.dbName;

      cPanelApp.showToast(`User "${user}" created!`, 'success');
      this.goToWizardStep(3);
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  wizardToggleAllPrivileges(checked) {
    document.querySelectorAll('.wizard-priv-check').forEach(cb => {
      cb.checked = checked;
    });
  },

  async wizardNextStep3() {
    const isAll = document.getElementById('wizard-priv-all').checked;
    let selectedPrivs = [];

    if (isAll) {
      selectedPrivs = ['ALL PRIVILEGES'];
    } else {
      document.querySelectorAll('.wizard-priv-check:checked').forEach(cb => {
        selectedPrivs.push(cb.value);
      });
    }

    if (selectedPrivs.length === 0) {
      cPanelApp.showToast('Please select at least one privilege.', 'error');
      return;
    }

    try {
      await cPanelApp.api('/api/mysql/privileges', {
        method: 'POST',
        body: {
          username: this.wizardData.username,
          database: this.wizardData.dbName,
          privileges: selectedPrivs
        }
      });

      this.wizardData.privileges = selectedPrivs;

      const s4User = document.getElementById('wizard-s4-display-user');
      const s4Db = document.getElementById('wizard-s4-display-db');
      const s4ValDb = document.getElementById('wizard-s4-val-dbname');
      const s4ValUser = document.getElementById('wizard-s4-val-username');
      const s4ValPass = document.getElementById('wizard-s4-val-password');
      const s4Snippet = document.getElementById('wizard-s4-code-snippet');

      if (s4User) s4User.textContent = this.wizardData.username;
      if (s4Db) s4Db.textContent = this.wizardData.dbName;
      if (s4ValDb) s4ValDb.textContent = this.wizardData.dbName;
      if (s4ValUser) s4ValUser.textContent = this.wizardData.username;
      if (s4ValPass) s4ValPass.textContent = this.wizardData.password;

      if (s4Snippet) {
        s4Snippet.textContent = `# Database Configuration (.env)
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=${this.wizardData.dbName}
DB_USERNAME=${this.wizardData.username}
DB_PASSWORD=${this.wizardData.password}

# WordPress (wp-config.php)
define('DB_NAME',     '${this.wizardData.dbName}');
define('DB_USER',     '${this.wizardData.username}');
define('DB_PASSWORD', '${this.wizardData.password}');
define('DB_HOST',     'localhost');`;
      }

      this.goToWizardStep(4);
      cPanelApp.showToast('Database setup wizard completed successfully!', 'success');
      this.loadDatabases();
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  // ========================================================================
  // Remote MySQL Controller
  // ========================================================================
  async openRemote() {
    cPanelApp.openModal('modal-remote-mysql');
    await this.loadRemoteHosts();
  },

  async loadRemoteHosts() {
    const tbody = document.getElementById('remote-hosts-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Loading access hosts...</td></tr>';

    try {
      const data = await cPanelApp.api('/api/mysql/remote-hosts');
      if (!data.connected) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#ef4444;">MySQL service offline. Start MySQL to manage remote hosts.</td></tr>';
        return;
      }

      const hosts = data.hosts || [];
      if (hosts.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align:center; padding:20px; color:#64748b;">
              <i class="fa-solid fa-network-wired" style="font-size:24px; color:#cbd5e1; margin-bottom:8px; display:block;"></i>
              No remote access hosts configured yet.<br>
              Add <code>%</code> (for any host) or your local subnet (e.g. <code>192.168.1.%</code>) above to authorize external database tools.
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = hosts.map(h => `
        <tr>
          <td>
            <code style="font-size:13px; font-weight:700; color:#2563eb;">${h.host}</code>
          </td>
          <td><strong>${h.user || 'root'}</strong></td>
          <td style="color:#64748b;">${h.comment || '<span style="color:#cbd5e1;">None</span>'}</td>
          <td style="color:#64748b; font-size:12px;">${h.createdAt ? new Date(h.createdAt).toLocaleDateString() : 'Active'}</td>
          <td style="text-align:right;">
            <button class="btn-danger btn-sm" onclick="mysqlManager.deleteRemoteHost('${h.host}')" title="Revoke Host Access">
              <i class="fa-solid fa-trash"></i> Delete
            </button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" style="color:#ef4444;">Failed to load remote hosts: ${err.message}</td></tr>`;
    }
  },

  async addRemoteHost() {
    const hostInput = document.getElementById('new-remote-host');
    const commentInput = document.getElementById('new-remote-comment');
    const host = hostInput.value.trim();
    const comment = commentInput ? commentInput.value.trim() : '';

    if (!host) {
      cPanelApp.showToast('Please enter an IP address, wildcard subnet, or %', 'error');
      return;
    }

    try {
      await cPanelApp.api('/api/mysql/remote-hosts', {
        method: 'POST',
        body: { host, comment }
      });

      cPanelApp.showToast(`Access host "${host}" authorized!`, 'success');
      hostInput.value = '';
      if (commentInput) commentInput.value = '';
      await this.loadRemoteHosts();
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  async deleteRemoteHost(host) {
    if (!confirm(`Revoke remote MySQL access for host "${host}"?`)) return;

    try {
      await cPanelApp.api(`/api/mysql/remote-hosts/${encodeURIComponent(host)}`, {
        method: 'DELETE'
      });

      cPanelApp.showToast(`Remote host "${host}" access revoked.`, 'info');
      await this.loadRemoteHosts();
    } catch (err) {
      cPanelApp.showToast(err.message, 'error');
    }
  },

  setupListeners() {
    const createDbForm = document.getElementById('form-create-db');
    if (createDbForm) createDbForm.addEventListener('submit', (e) => this.createDb(e));

    const createUserForm = document.getElementById('form-create-user');
    if (createUserForm) createUserForm.addEventListener('submit', (e) => this.createUser(e));

    const addUsertoDbForm = document.getElementById('form-add-user-to-db');
    if (addUsertoDbForm) addUsertoDbForm.addEventListener('submit', (e) => this.openPrivilegesModal(e));

    const btnSavePrivs = document.getElementById('btn-save-privileges');
    if (btnSavePrivs) btnSavePrivs.addEventListener('click', () => this.savePrivileges());

    // Privileges "ALL" checkbox toggle
    const privAll = document.getElementById('priv-all');
    if (privAll) {
      privAll.addEventListener('change', (e) => {
        document.querySelectorAll('.priv-check').forEach(cb => {
          cb.checked = e.target.checked;
        });
      });
    }

    // Pass generator button
    const btnGenPass = document.getElementById('btn-generate-mysql-pass');
    if (btnGenPass) btnGenPass.addEventListener('click', () => this.generatePassword());
  }
};

window.mysqlManager = mysqlManager;
document.addEventListener('DOMContentLoaded', () => mysqlManager.init());
