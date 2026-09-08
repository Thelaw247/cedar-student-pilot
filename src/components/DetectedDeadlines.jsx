import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles } from 'lucide-react';
import { announceDataChange } from '@/lib/dataChanged';
import { deadlineTypeLabel } from '@/lib/assignmentScope';
import DeadlineForm, { DeadlineModal } from '@/components/DeadlineForm';

/**
 * "Praelecta heard a deadline in your lecture — should it go on the calendar?"
 *
 * This replaces AssignmentDetectedNotice, which announced an assignment the
 * server had already created and already booked a full set of study sessions
 * for. Its one button dismissed the notice, not the assignment, so a date the
 * model misheard or a professor talking about another section's essay was
 * work on the calendar that could only be removed by deleting something the
 * student never made.
 *
 * Now the server records candidates on the lecture (lectures.detected_deadlines)
 * and this asks. "Add it" opens the ordinary add form, pre-filled: the same
 * form, the same coverage step for an exam, the same plan check, the same
 * booking. A deadline Praelecta found and a deadline the student typed in are
 * the same deadline by the time they exist.
 *
 * The parent passes the lectures it has already loaded (Home and the class
 * page both hold them), so this costs no fetch of its own.
 */
export default function DetectedDeadlines({ lectures = [], assignments = [], onChanged = null }) {
  // Decisions made in this session, so a card leaves the moment it is
  // answered rather than waiting for the parent to refetch.
  const [resolved, setResolved] = useState({});
  const [adding, setAdding] = useState(null); // { lecture, item }

  // Already on the calendar. The server checks this once, when the lecture is
  // processed, and never looks again — so a student who typed the deadline in
  // themselves, or added it from this card on another device, would still be
  // asked, and "Add it" would make a second copy of their own midterm.
  const alreadyAdded = new Set(
    assignments.map((a) => `${a.class_id}|${a.due_date}|${String(a.title || '').toLowerCase()}`),
  );

  const pending = [];
  for (const lecture of lectures) {
    for (const [index, item] of (lecture?.detected_deadlines || []).entries()) {
      if (!item || item.decision) continue;
      const key = `${lecture.id}:${index}`;
      if (resolved[key]) continue;
      if (alreadyAdded.has(`${lecture.class_id}|${item.due_date}|${String(item.title || '').toLowerCase()}`)) continue;
      pending.push({ key, lecture, index, item });
    }
  }

  if (pending.length === 0 && !adding) return null;

  /**
   * Write one decision back onto its lecture.
   *
   * Read-modify-write of the whole array, like the rest of this app's jsonb
   * columns: the alternative is a jsonb_set expression the client cannot
   * send, and two tabs answering the same lecture's questions at the same
   * second is not a race worth a migration.
   */
  const decide = async (entry, decision, assignmentId = null) => {
    const { lecture, item, key } = entry;
    setResolved((prev) => ({ ...prev, [key]: decision }));
    try {
      const fresh = await base44.entities.Lecture.get(lecture.id);
      const list = Array.isArray(fresh?.detected_deadlines) ? [...fresh.detected_deadlines] : [];
      // Matched on what the question WAS, not on where it sat: reprocessing a
      // lecture rewrites the array, and answering by position could mark a
      // different deadline as the one the student just said no to. The index
      // is only the fallback for an entry with no title to match on.
      const same = (d) => d && d.due_date === item.due_date
        && String(d.title || '').toLowerCase() === String(item.title || '').toLowerCase();
      const at = list.findIndex(same);
      // No match means the question is not in the lecture any more — there is
      // nothing to answer. Falling back to the position would stamp this
      // decision onto whatever else now sits there, which is a different
      // deadline getting silently dismissed.
      if (at === -1) return;
      list[at] = { ...list[at], decision, ...(assignmentId ? { assignment_id: assignmentId } : {}) };
      await base44.entities.Lecture.update(lecture.id, { detected_deadlines: list });
      announceDataChange(['Lecture']);
      onChanged?.();
    } catch {
      // Worst case the question is asked again next visit. That is a re-ask,
      // not a lost deadline, and it cannot become a duplicate: if the answer
      // was "add it" the assignment now exists, and `alreadyAdded` above
      // drops the card before it can be answered a second time.
    }
  };

  // No busy state: decide() drops the card from `pending` in the same render
  // pass, so a spinner on this button would never be seen by a mounted card.
  const dismiss = (entry) => { decide(entry, 'dismissed'); };

  return (
    <div className="mb-4 space-y-2">
      {pending.map((entry) => {
        const { key, lecture, item } = entry;
        const label = deadlineTypeLabel(item.type);
        return (
          <div key={key} className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-start gap-3 animate-fade-in">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Heard {label === 'exam' || label === 'assignment' ? 'an' : 'a'} {label} in your {lecture.date} lecture
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                &ldquo;{item.title}&rdquo; — due {item.due_date}. Add it to your deadlines?
              </p>
              <div className="flex items-center gap-2 mt-2">
                <button type="button" onClick={() => setAdding(entry)}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90">
                  Add it
                </button>
                <button type="button" onClick={() => dismiss(entry)}
                  className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted">
                  No thanks
                </button>
              </div>
            </div>
            {/* No ✕ beside "No thanks". They would do the same thing, and a
                card that asks a yes-or-no question does not need three
                controls to answer it. */}
          </div>
        );
      })}

      {adding && (
        <DeadlineModal onClose={() => setAdding(null)}>
          <DeadlineForm
            classId={adding.lecture.class_id}
            initial={{ title: adding.item.title, due_date: adding.item.due_date, type: adding.item.type }}
            cancelLabel="Not now"
            onCancel={() => setAdding(null)}
            // Recorded the moment the row exists, before the plan notice, so
            // closing the modal on that notice cannot leave the question open
            // next to a deadline that is already on the calendar.
            onSaved={(assignment) => decide(adding, 'added', assignment?.id || null)}
            onDone={() => setAdding(null)}
          />
        </DeadlineModal>
      )}
    </div>
  );
}
