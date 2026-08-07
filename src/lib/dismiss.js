/**
 * dismiss — per-day "don't show this again today" helper for alerts/banners.
 *
 * Dismissal is scoped to today's date (matches the pattern already used by
 * AutoPrintPrompt), not permanent: an alert about a real, still-unresolved
 * problem (missed lectures, behind schedule, etc.) should come back tomorrow
 * rather than being silenced forever by one tap.
 */
function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export function isDismissedToday(key) {
  try {
    return localStorage.getItem(`cedar-dismiss-${key}`) === todayStr();
  } catch (e) {
    return false;
  }
}

export function dismissToday(key) {
  try {
    localStorage.setItem(`cedar-dismiss-${key}`, todayStr());
  } catch (e) { /* non-fatal: dismiss just won't persist this session */ }
}
