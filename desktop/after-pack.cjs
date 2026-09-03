// Ad-hoc sign the macOS app when there is no real certificate.
//
// electron-builder skips macOS signing entirely when no Developer ID is
// available ("cannot find valid Developer ID Application identity"), and Apple
// silicon refuses to launch an app carrying no signature at all: it opens as
// "Praelecta is damaged and can't be opened", which reads to a student like a
// broken download rather than "this developer has not bought a certificate
// yet". An ad-hoc signature (codesign --sign -) is enough for the app to run.
// Gatekeeper still shows the unidentified-developer warning on first open,
// which is the honest state until CSC_LINK holds a real certificate.
const { execFileSync } = require('node:child_process');
const path = require('node:path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  // A real certificate is configured, so electron-builder's own signing step
  // handles it (with the hardened runtime and entitlements). Leave it alone.
  if (process.env.CSC_LINK) return;

  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
  console.log(`[desktop] ad-hoc signed ${app}`);
};
