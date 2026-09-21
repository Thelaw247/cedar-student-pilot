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

const EXPECTED = ['Praelecta-Setup.exe', 'Praelecta-win.zip', 'Praelecta-mac-arm64.dmg', 'Praelecta-mac-x64.dmg', 'Praelecta-linux.AppImage', 'Praelecta-linux.deb'];

test('electron-builder produces exactly the fixed installer names the site links to', () => {
  assert.equal(pkg.build.nsis.artifactName, 'Praelecta-Setup.${ext}');
  assert.equal(pkg.build.win.artifactName, 'Praelecta-win.${ext}');
  assert.equal(pkg.build.linux.artifactName, 'Praelecta-linux.${ext}');
  assert.equal(pkg.build.mac.artifactName, 'Praelecta-mac-${arch}.${ext}');
  // The zip is the antivirus escape hatch: an unsigned NSIS stub is what gets
  // quarantined, and a plain archive of the same app usually is not. Losing it
  // leaves a blocked student with nothing to fall back to.
  assert.deepEqual(pkg.build.win.target.map((t) => t.target), ['nsis', 'zip']);
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
  for (const runner of ['windows-latest', 'ubuntu-latest']) assert.match(workflow, new RegExp(runner));
  assert.match(workflow, /sha256sum \* > SHA256SUMS\.txt/, 'publish checksums so a flagged download can be verified');
});

test('the Mac app is built for Apple silicon and Intel and uploaded under fixed names', () => {
  // Shipped from desktop-v1.0.4. It was pulled at 1.0.2 because nobody had a
  // Mac to open it on; the launch step below is what stands in for that.
  assert.equal(pkg.build.mac.artifactName, 'Praelecta-mac-${arch}.${ext}');
  assert.equal(pkg.build.dmg.artifactName, 'Praelecta-mac-${arch}.${ext}');
  assert.deepEqual(pkg.build.mac.target.map((t) => t.target), ['dmg']);
  assert.deepEqual(pkg.build.mac.target[0].arch, ['arm64', 'x64']);
  const matrix = workflow.slice(workflow.indexOf('include:'), workflow.indexOf('defaults:'));
  assert.match(matrix, /- os: macos-latest\s+name: macOS/);
  for (const file of ['Praelecta-mac-arm64.dmg', 'Praelecta-mac-x64.dmg']) {
    assert.match(matrix, new RegExp(`desktop/release/${file.replace('.', '\\.')}`), `${file} not uploaded by the workflow`);
  }
});

test('the macOS job launches the app it built before anything is released', () => {
  const start = workflow.indexOf('- name: Launch the Mac app');
  assert.ok(start > -1, 'the Mac app would ship without anyone having opened it');
  const step = workflow.slice(start, workflow.indexOf('- uses: actions/upload-artifact@v4'));
  assert.ok(start < workflow.indexOf('- uses: actions/upload-artifact@v4'), 'the launch has to gate the upload');
  assert.match(step, /if: runner\.os == 'macOS'/);
  // Apple silicon kills an app whose signature does not verify, and without
  // the usage string macOS kills it on the first getUserMedia.
  assert.match(step, /codesign --verify --deep --strict/);
  assert.match(step, /plutil -extract NSMicrophoneUsageDescription raw/);
  // Started, and got as far as loading the site in its window.
  assert.match(step, /--remote-debugging-port=\d+/);
  assert.match(step, /https:\/\/praelecta\\\.ca/);
  assert.match(step, /exited during launch"; cat launch\.log; exit 1/);
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
  // Without the usage string macOS kills the app on getUserMedia, and without
  // the entitlement a Developer ID build (hardened runtime) denies the
  // microphone silently.
  assert.ok(pkg.build.mac.extendInfo.NSMicrophoneUsageDescription.length > 20);
  assert.match(read('../../desktop/build/entitlements.mac.plist'), /com\.apple\.security\.device\.audio-input/);
});

test('the Windows installer shows a wizard rather than installing on one click', () => {
  // A silent one-click installer that writes to disk and launches itself is a
  // shape antivirus heuristics score against, and it is the worse first run.
  assert.equal(pkg.build.nsis.oneClick, false);
  assert.equal(pkg.build.nsis.allowToChangeInstallationDirectory, true);
});

test('an unsigned macOS build is still ad-hoc signed so Apple silicon will launch it', () => {
  // electron-builder skips macOS signing when no Developer ID exists, and an
  // app with no signature at all opens as "damaged" on Apple silicon -- a
  // broken download, not a Gatekeeper warning. The afterPack hook signs it
  // ad-hoc in exactly that case.
  assert.equal(pkg.build.afterPack, './after-pack.cjs');
  const hook = read('../../desktop/after-pack.cjs');
  assert.match(hook, /electronPlatformName !== 'darwin'/);
  assert.match(hook, /process\.env\.CSC_LINK/, 'a real certificate must take precedence over ad-hoc signing');
  assert.match(hook, /'--sign', '-'/);
});

test('the landing page shows the download section and links it from the footer', () => {
  assert.match(landing, /<LandingDownloads \/>/);
  // The footer is shared by every public page, so its anchor is written as
  // /#download: a scroll on the homepage, the homepage itself from anywhere else.
  const footer = read('../../src/components/landing/LandingFooter.jsx');
  assert.match(footer, /href="\/#download"/);
});

test('a Mac visitor is offered the Apple silicon build first, and an iPad is not offered a Mac app', async () => {
  const { DESKTOP_DOWNLOADS, detectDesktopOs } = await import('../../src/lib/desktopDownloads.js');
  const macs = DESKTOP_DOWNLOADS.filter((d) => d.id.startsWith('mac'));
  // The download section puts the first entry matching the visitor's OS on
  // the big button; most Macs a student owns are Apple silicon.
  assert.deepEqual(macs.map((d) => d.file), ['Praelecta-mac-arm64.dmg', 'Praelecta-mac-x64.dmg']);
  const as = (nav) => {
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true });
    try { return detectDesktopOs(); } finally { if (saved) Object.defineProperty(globalThis, 'navigator', saved); }
  };
  const safariOnMac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';
  assert.equal(as({ userAgent: safariOnMac, platform: 'MacIntel', maxTouchPoints: 0 }), 'mac');
  assert.equal(as({ userAgent: safariOnMac, platform: 'MacIntel', maxTouchPoints: 5 }), null, 'an iPad would be handed a .dmg');
  assert.equal(as({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32', maxTouchPoints: 10 }), 'windows');
});
