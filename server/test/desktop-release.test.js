import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// The landing page links to fixed installer names on the "latest" GitHub
// Release. Those names are decided in three places that never see each
// other at runtime: desktop/package.json (electron-builder artifactName), the
// release workflow (which files it uploads), and src/lib/desktopDownloads.js
// (what the buttons point at). If any one drifts, the download buttons 404
// with no build failing. Pin them together here.

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const pkg = JSON.parse(read('../../desktop/package.json'));
const workflow = read('../../.github/workflows/desktop-release.yml');
const downloads = read('../../src/lib/desktopDownloads.js');
const landing = read('../../src/pages/Landing.jsx');
const main = read('../../desktop/main.cjs');

const EXPECTED = ['Praelecta-Setup.exe', 'Praelecta-mac.dmg', 'Praelecta-linux.AppImage', 'Praelecta-linux.deb'];

test('electron-builder produces exactly the fixed installer names the site links to', () => {
  assert.equal(pkg.build.win.artifactName, 'Praelecta-Setup.${ext}');
  assert.equal(pkg.build.mac.artifactName, 'Praelecta-mac.${ext}');
  assert.equal(pkg.build.linux.artifactName, 'Praelecta-linux.${ext}');
  assert.deepEqual(pkg.build.win.target.map((t) => t.target), ['nsis']);
  assert.deepEqual(pkg.build.mac.target.map((t) => t.target), ['dmg']);
  assert.deepEqual(pkg.build.linux.target.map((t) => t.target).sort(), ['AppImage', 'deb']);
  // Every name in the download list must be one electron-builder emits.
  for (const file of EXPECTED) assert.match(downloads, new RegExp(file.replace('.', '\\.')), `${file} missing from desktopDownloads.js`);
  assert.match(downloads, /releases\/latest\/download/);
});

test('the release workflow uploads those same files and publishes them as the latest release', () => {
  for (const file of EXPECTED) assert.match(workflow, new RegExp(`desktop/release/${file.replace('.', '\\.')}`), `${file} not uploaded by the workflow`);
  assert.match(workflow, /tags: \['desktop-v\*'\]/);
  assert.match(workflow, /softprops\/action-gh-release@v2/);
  assert.match(workflow, /make_latest: true/);
  assert.match(workflow, /contents: write/);
  // All three OS runners, or one platform silently disappears from the release.
  for (const runner of ['windows-latest', 'macos-latest', 'ubuntu-latest']) assert.match(workflow, new RegExp(runner));
});

test('signing variables are only exported when the certificate secrets exist', () => {
  // A missing repository secret expands to the empty string, and an empty
  // CSC_LINK tells electron-builder a certificate IS configured -- it then
  // imports from an empty path and the macOS build dies with "not a file".
  // The build step must therefore never receive the raw secret expressions.
  const buildStep = workflow.slice(workflow.indexOf('- name: Build installers'), workflow.indexOf('- name: List output'));
  for (const name of ['CSC_LINK', 'CSC_KEY_PASSWORD', 'WIN_CSC_LINK', 'WIN_CSC_KEY_PASSWORD']) {
    assert.doesNotMatch(buildStep, new RegExp(`^\\s+${name}:`, 'm'), `${name} must not be set unconditionally on the build step`);
  }
  assert.match(workflow, /- name: Configure code signing/);
  assert.match(workflow, /if \[ -n "\$MAC_LINK" \]/);
  assert.match(workflow, /if \[ -n "\$WIN_LINK" \]/);
});

test('the desktop shell is locked down and keeps sign-in and Stripe in-window', () => {
  assert.match(main, /contextIsolation: true/);
  assert.match(main, /nodeIntegration: false/);
  assert.match(main, /sandbox: true/);
  // Microphone is the product; it must be granted for the app origin only.
  assert.match(main, /permission === 'media'/);
  assert.match(main, /requestingOrigin !== APP_ORIGIN\) return false/);
  for (const host of ['accounts\\.google\\.com', 'appleid\\.apple\\.com', 'checkout\\.stripe\\.com', 'supabase\\.co']) {
    assert.ok(main.includes(host), `${host} would open in the system browser and never redirect back`);
  }
  // The mac build declares why it wants the microphone, or macOS kills the app on getUserMedia.
  assert.ok(pkg.build.mac.extendInfo.NSMicrophoneUsageDescription.length > 20);
  assert.match(read('../../desktop/build/entitlements.mac.plist'), /com\.apple\.security\.device\.audio-input/);
});

test('the landing page shows the download section and links it from the footer', () => {
  assert.match(landing, /<LandingDownloads \/>/);
  assert.match(landing, /href="#download"/);
});
