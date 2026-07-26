import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { getSetting } from '@/lib/settings';
import { getDecayPreset } from '@/lib/conceptDecay';
import { CalendarCheck, Check, Loader2, Brain } from 'lucide-react';

/**
 * Shown right after a lecture recording finishes processing.
 * Offers to lock in spaced-repetition review sessions for the lecture that
 * was just recorded — the moment intent is highest and the material is
 * freshest. Reuses the app's existing concept-decay intervals so the review
 * cadence matches the memory model the rest of the app already uses.
 *
 * Props:
 *   classId    — the class the lecture belongs to
 *   lectureId  — the freshly created lecture
 *   onDone     — called when the prompt is finished (scheduled, once, or skipped)
 */
export default function PostRecordingReviewPrompt({ classId, lectureId, onDone }) {
  const [saving, setSaving] = useState(false);
  const [scheduled, setScheduled] = useState(null); // array of {date} once done

  // Build spaced review dates from the user's decay preset.
  // decayStart = when a lecture begins to fade; we place reviews leading up to
  // and through the decay window so each review lands right as memory dips.
  const buildReviewDates = () => {
    const preset = getDecayPreset();
    const start = preset.decayStart; // e.g. 14 (default), 7 (fast), 21 (slow)
    const end = preset.decayEnd;     // e.g. 28 (default)
    // Three spaced touchpoints: a short first pass, then at the fade point,
    // then near full decay. Kept proportional to the chosen preset so "Fast"
    // learners get tighter spacing automatically.
    const offsets = [
      Math.max(1, Math.round(start * 0.2)),  // early consolidation
      Math.round(start * 0.6),               // before it fades
      Math.round((start + end) / 2),         // deep-decay refresh
    ];
    // De-dupe in case rounding collapses two offsets together.
    const unique = [...new Set(offsets)].sort((a, b) => a - b);
    const today = new Date();
    return unique.map(days => {
      const d = new Date(today);
      d.setDate(d.getDate() + days);
      return {
        date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        days,
      };
    });
  };

  const preferredTime = () => {
    const times = getSetting('reviewTimes') || [];
    return times.length > 0 ? times[0] : '19:00';
  };

  const scheduleReviews = async () => {
    setSaving(true);
    try {
      const dates = buildReviewDates();
      const time = preferredTime();
      const records = dates.map(({ date }) => ({
        class_id: classId,
        lecture_id: lectureId,
        scheduled_date: date,
        scheduled_time: time,
        duration_minutes: 20,
        priority: 'medium',
        status: 'scheduled',
        session_type: 'review',
        notes: 'Auto-scheduled review for a recorded lecture.',
      }));
      await Promise.all(records.map(r => base44.entities.StudySession.create(r)));
      setScheduled(dates);
    } catch (e) {
      // Non-fatal: the recording is already saved. Just close on failure.
      onDone();
      return;
    }
    setSaving(false);
  };

  const fmt = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  // Confirmation view — reviews were scheduled
  if (scheduled) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 glass p-4">
        <div className="bg-card rounded-2xl border border-border p-8 max-w-sm w-full text-center animate-fade-in">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
            <CalendarCheck className="w-7 h-7 text-emerald-600" />
          </div>
          <h3 className="font-heading text-lg font-semibold mb-1">Reviews Scheduled</h3>
          <p className="text-sm text-muted-foreground mb-4">
            You'll get a nudge to review this lecture on:
          </p>
          <div className="space-y-2 mb-6 text-left">
            {scheduled.map(({ date }, i) => (
              <div key={i} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg bg-muted">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                <span className="text-foreground font-medium">{fmt(date)}</span>
              </div>
            ))}
          </div>
          <button onClick={onDone}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            Done
          </button>
        </div>
      </div>
    );
  }

  // Offer view — ask whether to schedule
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 glass p-4">
      <div className="bg-card rounded-2xl border border-border p-8 max-w-sm w-full text-center animate-fade-in">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Brain className="w-7 h-7 text-primary" />
        </div>
        <h3 className="font-heading text-lg font-semibold mb-1">Lecture Saved</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Want to lock in a few review sessions so this doesn't slip away? I'll space them out and remind you.
        </p>
        <div className="space-y-2">
          <button onClick={scheduleReviews} disabled={saving}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Scheduling...</> : <><CalendarCheck className="w-4 h-4" /> Schedule review sessions</>}
          </button>
          <button onClick={onDone} disabled={saving}
            className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50">
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}
