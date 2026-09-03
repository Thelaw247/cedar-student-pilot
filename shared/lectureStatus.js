/**
 * The lecture processing statuses, in one place.
 *
 * These are not free-form strings: the database enforces them.
 *
 *   alter table public.lectures add constraint lectures_status_check
 *     CHECK (status = ANY (ARRAY['pending', 'processing', 'complete']));
 *
 * Note "complete", not "completed". Assignments and study sessions use
 * "completed", and that near-miss has already cost us once: the recording
 * client polled for 'completed', which a lecture can never be, so a save that
 * had actually succeeded on the server looked to the student like it hung —
 * and every retry created another lecture and charged again. server/test/
 * lecture-status.test.js now asserts this file against the schema snapshot.
 */

export const LECTURE_PENDING = 'pending';
export const LECTURE_PROCESSING = 'processing';
export const LECTURE_COMPLETE = 'complete';

/** Every status the database will accept, in schema order. */
export const LECTURE_STATUSES = [LECTURE_PENDING, LECTURE_PROCESSING, LECTURE_COMPLETE];

/**
 * How long a lecture may sit in 'processing' before the work is presumed dead.
 *
 * The route releases a lecture back to 'pending' in a catch block, which only
 * runs in-process: if the API restarts or is redeployed mid-run, that release
 * never happens and the row says "Processing…" forever. Three things key off
 * this one number — claimLecture's stale re-claim, the sweeper that reclaims
 * abandoned rows on a schedule, and the lecture page's decision to stop
 * waiting and offer a retry — so it lives here rather than in any of them.
 */
export const PROCESSING_STALE_MINUTES = 15;

/** True once the server is finished with a lecture, successfully. */
export function isLectureComplete(lecture) {
  return lecture?.status === LECTURE_COMPLETE;
}
