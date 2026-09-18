/**
 * The proof line on the landing page, from the public counts.
 *
 * Praelecta is weeks old, so the numbers are small; they are shown as what
 * they are — early students, not a crowd — rather than inflated or hidden.
 * With no counts (API unreachable, or nothing recorded yet) the line still
 * reads truthfully.
 */
export function proofLine(stats) {
  if (!stats || !(Number(stats.lectures) > 0)) return 'Early students are testing Praelecta on their own classes. Join them.';
  const lectures = Number(stats.lectures);
  const students = Number(stats.students) || 0;
  const who = students > 0
    ? `${students} student${students === 1 ? ' has' : 's have'}`
    : 'Early students have';
  return `${who} recorded ${lectures} lecture${lectures === 1 ? '' : 's'} with Praelecta so far. Join them.`;
}
