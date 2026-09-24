# 🤝 Contributing to cPanel-LocalHost

First off, thank you for considering contributing to **cPanel-LocalHost**! 🙌

Projects like this thrive because of community contributions, bug reports, and suggestions.

---

## 🛠️ How Can You Contribute?

### 1. Reporting Bugs
- Search existing [Issues](https://github.com/shubhXlab/cPanel-LocalHost/issues) to ensure the bug hasn't already been reported.
- If not found, use the **Bug Report** template to submit details including your OS, Node.js version, and steps to reproduce.

### 2. Suggesting Enhancements
- Have an idea for a new cPanel Jupiter module or AI Gateway capability?
- Open an issue using the **Feature Request** template.

### 3. Submitting Pull Requests
1. **Fork** the repository and create your branch from `main`:
   ```bash
   git checkout -b feature/amazing-feature
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Make your changes** cleanly. Keep formatting consistent.
4. **Run tests**:
   ```bash
   npm start & node test_cpanel_suite.js
   ```
5. **Commit your changes**:
   ```bash
   git commit -m "feat: add support for custom PHP extensions"
   ```
6. **Push to your fork**:
   ```bash
   git push origin feature/amazing-feature
   ```
7. Open a **Pull Request** against `shubhXlab/cPanel-LocalHost:main`.

---

## 📜 Code Style & Standards

- **Backend**: Node.js standard JavaScript (CommonJS), Express modular routing.
- **Frontend**: Clean vanilla JavaScript, modular UI scripts in `client/js/`, authentic Jupiter CSS.
- **Security**: Always enforce chroot jails on file access, sanitize inputs, and prevent directory traversal.

---

## ⚖️ License
By contributing, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
