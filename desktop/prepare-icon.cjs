// The desktop icon is the same 512px mark the web app already ships as its
// PWA icon. Copying it at build time (instead of committing a second copy)
// keeps one source of truth for the brand mark; electron-builder converts
// the PNG into .ico / .icns for each platform itself.
const fs = require('node:fs');
const path = require('node:path');

const source = path.join(__dirname, '..', 'public', 'android-chrome-512x512.png');
const target = path.join(__dirname, 'build', 'icon.png');

if (!fs.existsSync(source)) {
  console.error(`[desktop] icon source missing: ${source}`);
  process.exit(1);
}
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
console.log(`[desktop] icon -> ${path.relative(process.cwd(), target)}`);
