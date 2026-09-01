/**
 * Shared avatar-fallback logic. Used by both the header UserMenuButton and
 * the profile settings page so a person's initials/colour never disagree
 * between the two places they appear.
 */

/** First letter of the first two words of a name, e.g. "Alex Chen" -> "AC".
 *  A single-word name gives one letter. No name gives "?". */
export function getInitials(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic background colour for the initials fallback, picked from
 *  the user id so the same person always gets the same colour across
 *  sessions and devices, without needing to store a colour choice. */
const PALETTE = ['#2E66FF', '#7C3AED', '#059669', '#DB2777', '#D97706', '#0891B2'];
export function getAvatarColor(seed) {
  const s = String(seed || '');
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}
