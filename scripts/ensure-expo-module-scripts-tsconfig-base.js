const fs = require('fs');
const path = require('path');

const packageDir = path.join(__dirname, '..', 'node_modules', 'expo-module-scripts');
const source = path.join(packageDir, 'tsconfig.base.json');
const target = path.join(packageDir, 'tsconfig.base');

if (!fs.existsSync(packageDir)) {
  console.log('[postinstall] expo-module-scripts is not installed; skipping tsconfig.base compatibility check.');
  process.exit(0);
}

if (!fs.existsSync(source)) {
  console.warn('[postinstall] Missing expo-module-scripts/tsconfig.base.json; cannot create compatibility file.');
  process.exit(0);
}

if (!fs.existsSync(target)) {
  fs.copyFileSync(source, target);
  console.log('[postinstall] Created expo-module-scripts/tsconfig.base compatibility file.');
} else {
  console.log('[postinstall] expo-module-scripts/tsconfig.base already exists.');
}
