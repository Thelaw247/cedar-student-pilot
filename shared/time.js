/**
 * Shared time helpers (Design Blueprint, global fix #3).
 *
 * These three functions were copy-pasted in Timeline, UpNextCard,
 * TodayIntelligenceCard, WeekView, and ClassStatusBar — five drifting copies.
 * This is now the only place clock math lives. All helpers work on the app's
 * canonical "HH:MM" 24-hour strings from the schedule entities.
 */

/** "14:30" -> 870 (minutes since midnight). Returns null for empty input. */
export function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const parts = timeStr.split(':').map(Number);
  return parts[0] * 60 + (parts[1] || 0);
}

/** "14:30" -> "2:30 PM". Empty input -> "". */
export function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const dh = h % 12 || 12;
  return `${dh}:${String(m || 0).padStart(2, '0')} ${ampm}`;
}

/** 95 -> "1h 35m", 60 -> "1h", 12 -> "12 min", <1 -> "now". */
export function formatCountdown(minutes) {
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/**
 * "17:30" + 50 minutes -> "18:20"; null when the session has no time or no
 * length. A booked study session has a length, so its block on a timeline
 * can have an end, like a class.
 */
export function sessionEndTime(session) {
  const start = parseTimeToMinutes(session?.scheduled_time);
  const minutes = Number(session?.duration_minutes);
  if (start == null || !Number.isFinite(minutes) || minutes <= 0) return null;
  const end = Math.min(start + Math.round(minutes), 24 * 60 - 1);
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}

/** 767 (seconds) -> "12:47". Used by recording + focus timers. */
export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Local date as "YYYY-MM-DD" (never UTC-shifted like toISOString). */
export function todayString(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * "2026-09-27" -> "Sep 27"; a date in another year -> "Sep 27, 2025"; with
 * `weekday` -> "Sat, Sep 27". For every place a lecture, deadline or session
 * date is shown: students read "Sep 27" at a glance and "2026-09-27" twice.
 * Accepts the app's "YYYY-MM-DD" strings, ISO timestamps and Dates; a plain
 * date is read as local midnight so it never slips a day near UTC. Empty or
 * unreadable input -> "" (an unreadable string comes back as it was).
 */
export function formatShortDate(value, { weekday = false, now = new Date() } = {}) {
  if (!value) return '';
  const d = value instanceof Date
    ? value
    : new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return typeof value === 'string' ? value : '';
  const options = { month: 'short', day: 'numeric' };
  if (weekday) options.weekday = 'short';
  if (d.getFullYear() !== now.getFullYear()) options.year = 'numeric';
  return d.toLocaleDateString('en-US', options);
}

/** ['2026-08-24', ..., '2026-08-30'] -> "Aug 24 – 30" (or "Aug 31 – Sep 6"). */
export function formatWeekRange(dates) {
  if (!dates?.length) return '';
  const a = new Date(`${dates[0]}T00:00:00`);
  const b = new Date(`${dates[dates.length - 1]}T00:00:00`);
  const mA = a.toLocaleDateString('en-US', { month: 'short' });
  const mB = b.toLocaleDateString('en-US', { month: 'short' });
  return mA === mB
    ? `${mA} ${a.getDate()} – ${b.getDate()}`
    : `${mA} ${a.getDate()} – ${mB} ${b.getDate()}`;
}
