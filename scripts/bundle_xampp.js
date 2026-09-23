const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const appRoot = path.resolve(__dirname, '..');
const targetXamppDir = path.join(appRoot, 'xampp');
const sourceXamppDir = process.env.XAMPP_PATH || 'C:\\xampp';

console.log('========================================================');
console.log('          XAMPP Portable Bundling Utility               ');
console.log('========================================================');
console.log(`Source XAMPP: ${sourceXamppDir}`);
console.log(`Target XAMPP: ${targetXamppDir}`);
console.log('--------------------------------------------------------');

if (!fs.existsSync(sourceXamppDir)) {
  console.error(`[Error] Source XAMPP not found at ${sourceXamppDir}`);
  process.exit(1);
}

if (!fs.existsSync(targetXamppDir)) {
  fs.mkdirSync(targetXamppDir, { recursive: true });
}

// Core components required for full cPanel functionality
const components = ['apache', 'mysql', 'php', 'phpMyAdmin', 'htdocs'];

const mode = process.argv.includes('--copy') ? 'copy' : 'junction';

for (const comp of components) {
  const src = path.join(sourceXamppDir, comp);
  const dest = path.join(targetXamppDir, comp);

  if (!fs.existsSync(src)) {
    console.warn(`[Skip] Component not found: ${src}`);
    continue;
  }

  if (fs.existsSync(dest)) {
    console.log(`[Exists] ${comp} is already present in target.`);
    continue;
  }

  if (mode === 'junction') {
    try {
      console.log(`[Linking] Creating NTFS Junction for ${comp}...`);
      execSync(`mklink /J "${dest}" "${src}"`, { stdio: 'inherit' });
    } catch (err) {
      console.warn(`Junction failed for ${comp}, falling back to directory copy.`);
      fs.cpSync(src, dest, { recursive: true });
    }
  } else {
    console.log(`[Copying] Copying ${comp} (this may take a minute)...`);
    fs.cpSync(src, dest, { recursive: true });
  }
}

console.log('========================================================');
console.log('✅ Built-in XAMPP integration ready in:');
console.log(`   ${targetXamppDir}`);
console.log('cPanel.exe and xamppConfig.js will now prioritize this local XAMPP!');
console.log('========================================================');
