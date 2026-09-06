/**
 * The student's own calendar day, as 'YYYY-MM-DD'.
 *
 * Lectures carry the local date they were recorded on (RecordingContext
 * stamps it), so anything that asks "was this today?" has to ask in the
 * student's timezone. A UTC day drops an evening lecture the moment UTC rolls
 * past midnight — which is what "no lectures to review today" was, right
 * after a real recording.
 *
 * Eight files spell this out by hand today. This is not a campaign to migrate
 * all of them; it is the one copy shared by the two files that have to agree
 * about what "today" means — the shelf that greys out today's review, and the
 * runner that would answer it.
 */
export function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** `days` before today, same format. Used for the "past 7 days" window. */
export function daysAgo(days, from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  return localDay(d);
}
