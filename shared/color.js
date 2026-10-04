/**
 * Class-color tinting (Design Blueprint, global fix #5).
 *
 * Replaces every `color + '20'` string concat in the codebase. That hack only
 * worked for 6-digit hex values (it appends a hex alpha byte), silently broke
 * for hsl()/named colors, and produced muddy tints in dark mode. color-mix is
 * baseline in every browser Praelecta targets (iOS 16.2+).
 */

/** A translucent tint of a class color, for icon chips and soft fills. */
export function classTint(color, percent = 14) {
  if (!color) return undefined;
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

/** The class color itself, with a safe brand-token fallback. */
export function classColor(color) {
  return color || 'hsl(var(--primary))';
}

/** Near-black ink for text on a light fill: the auth screens' ground colour. */
const DARK_INK = '#0B0E16';

function luminance(hex) {
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The text colour for a label on a solid class-colour fill: white or near-black,
 * whichever has more contrast (WCAG). White on the preset class colours
 * measured 2.1 to 4.2:1 (amber, green and teal worst); near-black reads 4.6:1
 * or better on every preset, and white still wins on a dark custom colour.
 * Returns undefined for anything that is not a hex colour (the brand-token
 * fallback), so the caller's own class applies there.
 */
export function readableInk(color) {
  if (typeof color !== 'string') return undefined;
  let hex = color.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(hex)) hex = hex.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return undefined;
  const bg = luminance(hex);
  const onWhite = 1.05 / (bg + 0.05);
  const onInk = (bg + 0.05) / (luminance(DARK_INK.slice(1)) + 0.05);
  return onWhite >= onInk ? '#FFFFFF' : DARK_INK;
}

/**
 * Semantic state colors for the few inline/SVG contexts (charts, styled
 * bars) where a CSS var can't resolve in an attribute. These are the same
 * emerald/amber/red the utility classes use — one source, never ad-hoc.
 */
export const SEMANTIC = {
  good: '#10B981',
  warn: '#F59E0B',
  bad: '#EF4444',
};
