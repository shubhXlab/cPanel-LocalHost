// Authentication & Session Handler for Localhost cPanel

document.addEventListener('DOMContentLoaded', async () => {
  const loginForm = document.getElementById('login-form');
  const alertBox = document.getElementById('login-alert');
  const togglePassBtn = document.getElementById('toggle-password');
  const passInput = document.getElementById('password');
  const group2FA = document.getElementById('group-2fa');
  const token2faInput = document.getElementById('token2fa');
  const btnLogin = document.getElementById('btn-login');
  const btnText = document.getElementById('btn-text');

  // Toggle password visibility
  if (togglePassBtn) {
    togglePassBtn.addEventListener('click', () => {
      const isPass = passInput.type === 'password';
      passInput.type = isPass ? 'text' : 'password';
      document.getElementById('eye-icon').className = isPass ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
    });
  }

  // Handle Login submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      alertBox.className = 'alert d-none';

      const username = document.getElementById('username').value.trim();
      const password = passInput.value;
      const token2fa = token2faInput ? token2faInput.value.trim() : null;

      btnText.textContent = 'Logging in...';
      btnLogin.disabled = true;

      try {
        // Fetch CSRF token first
        const csrfRes = await fetch('/api/auth/csrf-token');
        const csrfData = await csrfRes.json();
        const csrfToken = csrfData.csrfToken;

        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken
          },
          body: JSON.stringify({ username, password, token2fa })
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Login failed');
        }

        if (data.requires2FA) {
          group2FA.classList.remove('d-none');
          token2faInput.focus();
          alertBox.className = 'alert alert-info';
          alertBox.textContent = 'Two-Factor Authentication is active. Please enter your 6-digit code.';
          alertBox.style.display = 'block';
          btnText.textContent = 'Verify Code & Log in';
          btnLogin.disabled = false;
          return;
        }

        // Login success
        alertBox.className = 'alert alert-success';
        alertBox.textContent = 'Login successful! Redirecting to cPanel dashboard...';
        alertBox.style.display = 'block';

        setTimeout(() => {
          window.location.href = '/';
        }, 600);

      } catch (err) {
        alertBox.className = 'alert alert-danger';
        alertBox.textContent = err.message;
        alertBox.style.display = 'block';
        btnText.textContent = 'Log in';
        btnLogin.disabled = false;
      }
    });
  }

  // Forgot password helper
  const forgotBtn = document.getElementById('forgot-password');
  if (forgotBtn) {
    forgotBtn.addEventListener('click', (e) => {
      e.preventDefault();
      alert('Localhost Security Notice:\nTo reset your admin password, you can change it anytime directly in server/database/panelDb.js or in the Security Center inside cPanel.');
    });
  }
});
