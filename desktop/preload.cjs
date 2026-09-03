// Runs in the page with contextIsolation on. The only thing the site gets
// from the shell is a read-only marker so it can, for example, hide the
// "download the desktop app" buttons when it is already running inside it.
// (The version is in the user agent as PraelectaDesktop/x.y.z.)
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('praelectaDesktop', Object.freeze({
  isDesktop: true,
  platform: process.platform,
}));
