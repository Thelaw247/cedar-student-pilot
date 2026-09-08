import { base44 } from '@/api/base44Client';
import { getSetting } from '@/lib/settings';
import { announceDataChange } from '@/lib/dataChanged';

/**
 * Saving an exam, quiz, assignment or project — the one copy.
 *
 * This sequence existed twice, character for character, in the exam form on
 * the home screen and the add form on a class page: create the row, check the
 * auto-schedule setting, check the plan, book the sessions, and say something
 * sensible when any of that does not happen. Two copies meant two places to
 * fix and one of them was always a release behind.
 *
 * It also fixes a lie both copies told. The create and the booking sat inside
 * a single try, and the catch said "Saved, but the study sessions could not be
 * booked" — so a create that failed outright (no class, a network drop, a
 * rejected write) told the student their deadline was saved when no row
 * existed. The create throws now; only a failed booking is described as one.
 *
 * Resolves to `{ assignment, outcome, error? }` where outcome is one of:
 *   booked  sessions exist
 *   off     the student turned auto-scheduling off in Settings
 *   locked  their plan does not include study schedules — show the notice,
 *           which is the only place the upgrade path is offered
 *   failed  the deadline is saved and the booking is not; `error` says why
 */
export async function saveDeadline({ fields, scheduleAllowed, autoSchedule = null }) {
  const assignment = await base44.entities.Assignment.create(fields);
  // Every surface that lists deadlines refetches on this, so a new exam shows
  // up on the class page and the planner without either of them being told
  // directly. Announced before the booking so the deadline appears even if
  // the sessions are still being placed.
  announceDataChange(['Assignment']);

  const wantsSchedule = autoSchedule === null ? getSetting('autoGenerateSchedules') : autoSchedule;
  if (!wantsSchedule) return { assignment, outcome: 'off' };
  if (!scheduleAllowed) return { assignment, outcome: 'locked' };

  try {
    await bookSessionsFor(assignment.id);
    return { assignment, outcome: 'booked' };
  } catch (err) {
    console.error(err);
    return { assignment, outcome: 'failed', error: bookingErrorMessage(err) };
  }
}

/**
 * Book the standard prep sessions for a deadline that has none.
 *
 * Separate from saveDeadline because booking outlives creation: a student on
 * Student adds an exam, gets no sessions, upgrades a week later, and the
 * sessions have to be bookable then without re-creating anything. The server
 * re-checks the plan and refuses to book a second set (studyScheduler.js), so
 * calling this on an assignment that already has sessions is a no-op rather
 * than a duplicate column of work.
 */
export async function bookSessionsFor(assignmentId) {
  const res = await base44.functions.invoke('generateStudySchedule', { assignment_id: assignmentId });
  announceDataChange(['StudySession', 'Assignment']);
  return res?.data?.sessions_created ?? 0;
}

/** What went wrong, in the student's words rather than the transport's. */
export function bookingErrorMessage(err) {
  return err?.response?.data?.message
    || err?.response?.data?.error
    || 'Saved, but the study sessions could not be booked. Try again from the deadline itself.';
}
