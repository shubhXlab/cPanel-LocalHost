/**
 * cPanel Localhost - Landing & Download Page Configuration
 * You can customize the download links, versions, and checksums here.
 */
const CPANEL_CONFIG = {
  appName: "cPanel Localhost",
  tagline: "The Sovereign Local Web Hosting Control Panel for Developers & AI Agents",
  version: "1.0.0",
  releaseDate: "March 2026",
  license: "MIT License",
  author: "Shubham Ramjiyani",
  institution: "Ashoka Center for Business and Computer Studies (ACBCS)",

  // Download Files Configuration
  // If hosting directly on cPanel, keep relative paths like "cPanel-Localhost.exe"
  // If hosting on GitHub Releases or S3/R2 CDN, replace with full URL:
  // e.g. "https://github.com/shubham/cpanel-localhost/releases/download/v1.0.0/cPanel-Localhost.exe"
  downloads: {
    windowsExe: {
      filename: "cPanel-Localhost.exe",
      url: "cPanel-Localhost.exe",
      size: "132 MB",
      badge: "Standalone Executable",
      os: "Windows 10 / 11 (64-bit)",
      sha256: "CBD36CC625AD2804FDB3640B22E2B899E34BDD7FBB959CFC3BC6642CB48DCF1B",
      recommended: true
    },
    setupBundle: {
      filename: "Setup-cPanel-Localhost.zip",
      url: "Setup-cPanel-Localhost.zip",
      size: "130 MB",
      badge: "Setup Bundle",
      os: "Windows 10 / 11 (64-bit)",
      sha256: "BFEACA74C0E16FF44A6C3A661B2FA6A44CD36C400A86C4CFE05801ED3D1D9582",
      recommended: false
    },
    powershellInstall: `irm https://localhost.shubhxlab.xyz/cPanel-Localhost.exe -OutFile cPanel.exe; .\\cPanel.exe`
  },

  // Server default ports
  ports: {
    cpanel: 2083,
    cpanelHttp: 2082,
    apache: 80,
    mysql: 3306
  },

  // Subdomain & Hosting info for cPanel deployment
  hosting: {
    recommendedSubdomain: "localhost.shubhxlab.xyz",
    alternativeSubdomain: "download.shubhxlab.xyz",
    cpanelDocRoot: "public_html/localhost"
  }
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = CPANEL_CONFIG;
}
