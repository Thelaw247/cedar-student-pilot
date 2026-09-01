/**
 * Shared between the web app and the iOS app.
 *
 * Everything in shared/ is platform-free: no window, document, localStorage,
 * indexedDB, navigator, MediaRecorder or import.meta.env. That is enforced by a
 * test, not by convention, because the failure mode is silent — a browser API
 * added here still passes web lint and web tests, and only breaks when Metro
 * bundles it for a device.
 *
 * src/lib/<name>.js re-exports each of these, so every existing web import
 * keeps working unchanged and this move carries no risk to the web app.
 */
