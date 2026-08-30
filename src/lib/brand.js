// Praelecta brand assets.
//
// BRAND_MARK_URL is served from /public and has a TRANSPARENT background, so
// it sits correctly on any surface and in dark mode. Do not point this at an
// absolute media.base44.com URL — those are the OPAQUE app-icon renders
// (white-square background), which paint a visible white box wherever this
// is used inline (sidebar, home lockup). This file was reverted to an
// absolute glass-icon URL once already; if you're re-editing this, keep the
// local relative path.
export const BRAND_MARK_URL = '/logo-mark.png';

// Opaque square version. Correct for app icons and any place that needs a
// solid tile; wrong for inline UI. Served locally so it survives the domain
// move without depending on the Base44 CDN.
export const BRAND_ICON_URL = '/apple-touch-icon.png';
