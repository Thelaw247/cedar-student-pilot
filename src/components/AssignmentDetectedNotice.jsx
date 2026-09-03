import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Sparkles, X, ChevronRight } from 'lucide-react';

/**
 * "We pulled this from your lecture" notice (Phase 4, 3 Sep 2026). Shows for
 * any assignment the server auto-created from an explicit due-dated mention
 * in a lecture (processLectureRecording.js's detectAndCreateAssignments) —
 * one dismissible inline card per item, same visual language as
 * AutoPrintPrompt/AttendancePrompt, not a blocking modal (that mistake was
 * already made once this app's history — PostRecordingReviewPrompt — and
 * isn't worth repeating for a second feature).
 *
 * Dismissing sets notified=true on the assignment itself (not localStorage),
 * so it's a genuine one-time notice per assignment, consistent across
 * devices, rather than something that could reappear on a different browser.
 */
const TYPE_LABEL = { exam: 'exam', quiz: 'quiz', project: 'project', assignment: 'assignment' };

export default function AssignmentDetectedNotice() {
  const [items, setItems] = useState([]);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    base44.entities.Assignment.filter({ auto_created: true, notified: false })
      .then((rows) => { if (!cancelled) setItems(rows); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setChecked(true); });
    return () => { cancelled = true; };
  }, []);

  const dismiss = (id) => {
    setItems((prev) => prev.filter((a) => a.id !== id));
    base44.entities.Assignment.update(id, { notified: true }).catch(() => {
      // Worst case it shows again next visit — not harmful, just a re-ask.
    });
  };

  if (!checked || items.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {items.map((a) => (
        <div key={a.id} className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-start gap-3 animate-fade-in">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Pulled a {TYPE_LABEL[a.type] || 'assignment'} from your lecture
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              "{a.title}" — due {new Date(`${a.due_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. Study sessions are already booked for it.
            </p>
            <Link to="/planner" onClick={() => dismiss(a.id)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline mt-1.5">
              View in Study <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <button onClick={() => dismiss(a.id)} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
