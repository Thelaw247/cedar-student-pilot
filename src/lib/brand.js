// Cedar brand assets.
//
// CEDAR_LOGO_URL is served from /public and has a TRANSPARENT background, so
// it sits correctly on any surface and in dark mode. It previously pointed at
// the hosted apple-touch-icon, which is deliberately OPAQUE (Apple rejects
// icons with an alpha channel) and therefore painted a white square wherever
// it was used in the UI. Keep this the single source for the logo so every
// logo spot stays in sync.
export const CEDAR_LOGO_URL = '/logo-mark.png';

// Opaque square version. Correct for app icons and any place that needs a
// solid tile; wrong for inline UI. Kept hosted for external consumers.
export const CEDAR_ICON_URL =
  'https://base44.app/api/apps/6a485105cf0a684688950256/files/mp/public/6a485105cf0a684688950256/5ce816abf_apple-touch-icon.png';