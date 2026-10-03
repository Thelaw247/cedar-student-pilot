import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { fetchWithCache } from '@/hooks/useEntityData';
import { enqueueOperation } from '@/lib/syncQueue';
import { announceDataChange } from '@/lib/dataChanged';
import { GraduationCap, Check, X, Loader2, Clock, AlertTriangle } from 'lucide-react';
// Which sessions may be asked about lives in src/lib/attendance.js, where it
// is unit-tested. The rule that moved it there: a session is only askable if
// it ended after the class was added — an imported timetable used to produce
// a stack of questions about last week's classes before the Today page had
// even been seen once.
import { findPastUnconfirmedSessions } from '@/lib/attendance';
import { classTint, classColor } from '@/lib/color';
import { useRecording } from '@/recording/RecordingContext';

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// "Ask me later" means later, not the next time this component mounts.
// Switching Today → Weekly → Today used to bring the question straight back,
// so the dismissal is kept for the browser session.
const DISMISSED_KEY = 'praelecta-attendance-asked-later';
const wasDismissedThisSession = () => {
  try { return sessionStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; }
};

/**
 * What to tell the student when an answer could not be saved. The prompt
 * used to swallow every failure (console.error, nothing on screen), so a
 * lost connection or an expired session looked like a button that did not
 * work — and got pressed again, and again.
 */
export function describeAttendanceError(e) {
  const text = String(e?.message || e?.error_description || e?.details || '').toLowerCase();
  const status = Number(e?.status || e?.code || 0);
  if (/not signed in|jwt|refresh token|invalid token|session/.test(text) || status === 401) {
    return { kind: 'signed_out', text: 'Your session has ended. Sign in again, then answer this.' };
  }
  if (/failed to fetch|load failed|networkerror|network request failed|timeout/.test(text) || status === 0) {
    return { kind: 'network', text: "Couldn't reach the server. Check your connection and tap again — your answer is only saved once it goes through." };
  }
  // The error's own text is the database's (a constraint, a policy name), and
  // the caller logs it; the student gets a sentence.
  return { kind: 'unknown', text: 'This answer could not be saved. Tap again, or ask me later.' };
}

export default function AttendancePrompt() {
  const [pending, setPending] = useState([]);
  const [index, setIndex] = useState(0);
  // Which button is waiting on the server, so the spinner sits on the one
  // that was pressed instead of always on "Yes".
  const [submitting, setSubmitting] = useState(null);
  const [error, setError] = useState(null);
  const [dismissed, setDismissed] = useState(wasDismissedThisSession);
  // A full-screen scrim at z-50 sits over the recording pill at z-40. On
  // 8 Sep 2026 that is what buried an interrupted recording the app had
  // already found and was offering to save: the one screen that could give
  // the lecture back was underneath the one asking whether the student had
  // been in the room. Attendance can wait a visit; audio cannot.
  const { active: sessionActive } = useRecording();

  const loadPending = useCallback(async () => {
    try {
      const semesters = await fetchWithCache('Semester', 'filter', [{ is_active: true }]);
      if (semesters.length === 0) return;

      const classes = await fetchWithCache('Class', 'filter', [{ semester_id: semesters[0].id }]);
      if (classes.length === 0) return;

      // Fetch lectures and attendance for these classes
      const [allLectures, allAttendance] = await Promise.all([
        base44.entities.Lecture.list('-date', 200),
        base44.entities.ClassAttendance.list('-date', 200),
      ]);

      const sessions = findPastUnconfirmedSessions(classes, allLectures, allAttendance);
      setPending(sessions);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  const current = pending[index];

  const handleResponse = async (attended) => {
    if (!current || submitting) return;
    setSubmitting(attended ? 'yes' : 'no');
    setError(null);
    const row = {
      class_id: current.classObj.id,
      date: current.date,
      attended,
      confirmed_at: new Date().toISOString(),
    };
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        // Offline: the same queue the rest of the app uses. The answer is
        // written when the connection returns; the question moves on now.
        enqueueOperation({ entity: 'ClassAttendance', operation: 'create', args: [row] });
      } else {
        await base44.entities.ClassAttendance.create(row);
      }

      // Answering "yes" used to invoke generateMissedLectureSummary here, which
      // wrote an AI-invented lecture into the class and charged 2 credits for
      // it — from a yes/no question about attendance, with nothing on screen
      // saying that would happen. A student who wants an estimate asks for one
      // on the class page, where the confirmation says what it creates and the
      // notes box lets them anchor it to what they remember. This records
      // attendance and nothing else.
      setIndex(i => i + 1);
      // The progress ring and its "needs an attendance answer" line read the
      // same rows; tell them.
      announceDataChange(['ClassAttendance']);
    } catch (e) {
      console.error('[attendance] could not save the answer:', e?.message || e);
      setError(describeAttendanceError(e));
    }
    setSubmitting(null);
  };

  const handleDismissAll = () => {
    try { sessionStorage.setItem(DISMISSED_KEY, '1'); } catch { /* private mode: dismiss for this mount only */ }
    setDismissed(true);
  };

  if (dismissed || sessionActive || !current) return null;

  const remaining = pending.length - index;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 glass p-4">
      <div className="bg-card w-full max-w-sm rounded-2xl border border-border p-6 animate-fade-in text-center max-h-[90dvh] overflow-y-auto">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: classTint(current.classObj.color) || 'hsl(var(--primary) / 0.1)', color: classColor(current.classObj.color) }}>
          <GraduationCap className="w-7 h-7" strokeWidth={1.5} />
        </div>

        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
          Attendance Check
        </p>
        <h3 className="font-heading text-lg font-semibold text-foreground mb-1">
          {current.classObj.name}
        </h3>
        <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground mb-2">
          <Clock className="w-3.5 h-3.5" /> {formatDate(current.date)}
          {current.classObj.start_time && <span>• {current.classObj.start_time}</span>}
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          You didn't check in for this class. Did you attend?
        </p>

        {error && (
          <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-left text-xs leading-5 text-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-amber-500" aria-hidden="true" />
            <span>
              {error.text}
              {error.kind === 'signed_out' && (
                <> <Link to="/login" className="font-semibold text-primary hover:text-foreground">Sign in</Link></>
              )}
            </span>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => handleResponse(false)}
            disabled={!!submitting}
            aria-busy={submitting === 'no'}
            className="flex-1 inline-flex min-h-[44px] items-center justify-center gap-1.5 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            {submitting === 'no' ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />} No
          </button>
          <button
            onClick={() => handleResponse(true)}
            disabled={!!submitting}
            aria-busy={submitting === 'yes'}
            className="flex-1 inline-flex min-h-[44px] items-center justify-center gap-1.5 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {submitting === 'yes' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {submitting === 'yes' ? 'Saving…' : 'Yes'}
          </button>
        </div>

        {/* Always here. Gated on `remaining > 1`, a single pending session had
            no third door: the student had to answer a question about a class
            they might not remember, on a screen they did not ask for. A full
            44px tall, so a thumb lands on it. */}
        <button type="button" onClick={handleDismissAll}
          className="mt-2 inline-flex min-h-[44px] items-center justify-center px-4 text-xs text-muted-foreground hover:text-foreground transition-colors">
          {remaining > 1 ? `${remaining - 1} more pending — ask me later` : 'Ask me later'}
        </button>
      </div>
    </div>
  );
}
