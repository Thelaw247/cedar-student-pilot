/**
 * Class-color tinting (Design Blueprint, global fix #5).
 *
 * Replaces every `color + '20'` string concat in the codebase. That hack only
 * worked for 6-digit hex values (it appends a hex alpha byte), silently broke
 * for hsl()/named colors, and produced muddy tints in dark mode. color-mix is
 * baseline in every browser Cedar targets (iOS 16.2+).
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
