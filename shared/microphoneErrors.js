/**
 * What a failed microphone request actually means, so the UI can say the
 * right thing — the companion of saveErrors.js for the other end of a session.
 *
 * getUserMedia rejects for several unrelated reasons and the app used to
 * flatten every one of them into "Could not access the microphone. Please
 * grant permission and try again." A student whose Windows privacy switch
 * blocks desktop apps, whose headset is unplugged, or whose microphone is held
 * by a video call all read the same sentence, and all of them "granted
 * permission" (already granted) and tried again (same result). The report
 * that came back from the Windows desktop app on 18 Sep 2026 was, in full,
 * "it goes for 10 seconds and then times out" — because nothing on screen or
 * in the console said what the browser had actually said.
 *
 * Pure, shared with the iOS app.
 */

export const MIC_ERROR = {
  PERMISSION: 'permission',   // the page or the OS refused the microphone
  NO_DEVICE: 'no_device',     // nothing to capture from
  DEVICE_BUSY: 'device_busy', // a device exists but could not be started
  UNKNOWN: 'unknown',
};

const PERMISSION_NAMES = new Set(['NotAllowedError', 'PermissionDeniedError', 'PermissionDismissedError', 'SecurityError']);
const NO_DEVICE_NAMES = new Set(['NotFoundError', 'DevicesNotFoundError', 'OverconstrainedError', 'ConstraintNotSatisfiedError']);
// NotReadableError is the one that matters on Windows: the device is there and
// permission was granted, but the capture could not be started — most often
// because Windows' own "Let desktop apps access your microphone" switch is off,
// otherwise because another app holds the input.
const BUSY_NAMES = new Set(['NotReadableError', 'TrackStartError', 'AbortError']);

export function classifyMicrophoneError(error) {
  const name = String(error?.name || '');
  const message = String(error?.message || '');
  const detail = name ? (message ? `${name}: ${message}` : name) : message;
  if (PERMISSION_NAMES.has(name)) return { kind: MIC_ERROR.PERMISSION, name, message, detail };
  if (NO_DEVICE_NAMES.has(name)) return { kind: MIC_ERROR.NO_DEVICE, name, message, detail };
  if (BUSY_NAMES.has(name)) return { kind: MIC_ERROR.DEVICE_BUSY, name, message, detail };
  return { kind: MIC_ERROR.UNKNOWN, name, message, detail };
}

/**
 * Where the switch lives on each platform. Only the desktop app knows its
 * platform for certain (the shell exposes it); a browser tab gets no hint,
 * because the browser's own permission prompt is the thing to look at there.
 * @param {string|null|undefined} platform  Node's process.platform, as the shell reports it
 */
export function microphoneSettingsHint(platform) {
  if (platform === 'win32') {
    return 'On Windows, open Settings → Privacy & security → Microphone and turn on both "Microphone access" and "Let desktop apps access your microphone".';
  }
  if (platform === 'darwin') {
    return 'On a Mac, open System Settings → Privacy & Security → Microphone and allow Praelecta.';
  }
  return '';
}

/**
 * The headline and the sentence under it, per kind.
 * @param {{kind: string, name?: string, message?: string, detail?: string}} classified
 * @param {{platform?: string|null}} [context]
 */
export function describeMicrophoneError(classified, { platform = null } = {}) {
  const hint = microphoneSettingsHint(platform);
  switch (classified?.kind) {
    case MIC_ERROR.PERMISSION:
      return {
        title: 'Microphone permission was refused',
        body: `Allow the microphone for Praelecta and try again.${hint ? ` ${hint}` : ''}`,
      };
    case MIC_ERROR.NO_DEVICE:
      return {
        title: 'No microphone was found',
        body: 'Plug one in, or choose an input device in your system sound settings, then try again.',
      };
    case MIC_ERROR.DEVICE_BUSY:
      return {
        title: 'The microphone could not be started',
        body: `Another app may be using it, or the system is blocking apps from the microphone.${hint ? ` ${hint}` : ''}`,
      };
    default:
      return {
        title: 'Could not access the microphone',
        body: `Please check your microphone and try again.${hint ? ` ${hint}` : ''}`,
      };
  }
}
