// Runs in the page with contextIsolation on. What the site gets from the
// shell: a read-only marker so it can, for example, hide the "download the
// desktop app" buttons when it is already running inside it (the version is
// in the user agent as PraelectaDesktop/x.y.z), and two microphone helpers
// the record screen uses to say why a capture is failing and where the OS
// switch lives. Nothing else crosses the bridge.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('praelectaDesktop', Object.freeze({
  isDesktop: true,
  platform: process.platform,
  // 'granted' | 'denied' | 'restricted' | 'not-determined' | 'unknown' — what
  // the OS says about this app and the microphone (Windows and macOS; Linux
  // has no such switch and answers 'unknown').
  microphoneAccess: () => ipcRenderer.invoke('praelecta:microphone-access'),
  // Opens the OS microphone privacy page. Resolves true when there was one.
  openMicrophoneSettings: () => ipcRenderer.invoke('praelecta:open-microphone-settings'),
}));
