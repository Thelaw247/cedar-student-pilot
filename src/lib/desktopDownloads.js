// Desktop installers are attached to the GitHub Release the desktop-release
// workflow creates (.github/workflows/desktop-release.yml). The asset names
// are fixed by desktop/package.json (artifactName) so these links never
// change between versions: "latest" always resolves to the newest release.
const RELEASE_BASE = 'https://github.com/Thelaw247/cedar-student-pilot/releases/latest/download';

export const DESKTOP_DOWNLOADS = [
  { id: 'windows', label: 'Windows', note: 'Windows 10 or later · .exe installer', file: 'Praelecta-Setup.exe' },
  { id: 'mac', label: 'Mac (Apple silicon)', note: 'M1 and newer · .dmg', file: 'Praelecta-mac-arm64.dmg' },
  { id: 'mac-intel', label: 'Mac (Intel)', note: 'Pre-2020 Macs · .dmg', file: 'Praelecta-mac-x64.dmg' },
  { id: 'linux', label: 'Linux', note: 'AppImage, any distro', file: 'Praelecta-linux.AppImage' },
  { id: 'linux-deb', label: 'Linux (.deb)', note: 'Ubuntu, Debian, Mint', file: 'Praelecta-linux.deb' },
].map((d) => ({ ...d, url: `${RELEASE_BASE}/${d.file}` }));

export const DESKTOP_RELEASES_URL = 'https://github.com/Thelaw247/cedar-student-pilot/releases/latest';

/** Best guess at the visitor's OS so their download comes first. */
export function detectDesktopOs() {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent || '';
  const nav = /** @type {{ userAgentData?: { platform?: string }, platform?: string }} */ (/** @type {unknown} */ (navigator));
  const platform = nav.userAgentData?.platform || nav.platform || '';
  if (/iphone|ipad|android/i.test(ua)) return null;
  if (/win/i.test(platform) || /windows/i.test(ua)) return 'windows';
  if (/mac/i.test(platform) || /macintosh/i.test(ua)) return 'mac';
  if (/linux/i.test(platform) || /linux/i.test(ua)) return 'linux';
  return null;
}

/** True when the page is already running inside the desktop app. */
export function isRunningInDesktopApp() {
  if (typeof window === 'undefined') return false;
  const bridge = /** @type {{ praelectaDesktop?: { isDesktop?: boolean } }} */ (/** @type {unknown} */ (window));
  return Boolean(bridge.praelectaDesktop?.isDesktop) || /PraelectaDesktop\//.test(navigator.userAgent || '');
}
