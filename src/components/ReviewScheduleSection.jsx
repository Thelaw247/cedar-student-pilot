import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Plus, X, Clock, Loader2 } from 'lucide-react';

/**
 * Preferred daily study/review times (3 Sep 2026: moved off localStorage
 * onto profiles.preferred_study_times). This used to be a client-only
 * setting that nothing on the server could see — it looked like it drove
 * "we'll remind you to review at these times", but no actual booking route
 * ever read it. Now it's the one input every scheduler (lecture reviews,
 * assignment study sessions, project time) uses to decide WHEN a session is
 * allowed to land: each time opens a window around itself that sessions are
 * restricted to. No times set → schedulers fall back to a default
 * afternoon/evening window, so nothing breaks for a student who hasn't set
 * one yet.
 */
export default function ReviewScheduleSection() {
  const [times, setTimes] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [newTime, setNewTime] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    base44.auth.me()
      .then((me) => { if (!cancelled) { setTimes(me.preferred_study_times || []); setLoaded(true); } })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const save = async (updated) => {
    setTimes(updated);
    setSaving(true);
    try {
      await base44.auth.updateMe({ preferred_study_times: updated });
    } catch (e) {
      // Non-fatal to the UI — the list already reflects the intended state;
      // a failed save just means it didn't persist. Worth a retry, not a
      // blocking error over a settings toggle.
      console.error('[settings] could not save preferred study times:', e?.message || e);
    }
    setSaving(false);
  };

  const addTime = () => {
    if (!newTime || times.includes(newTime)) return;
    save([...times, newTime].sort());
    setNewTime('');
  };

  const removeTime = (t) => save(times.filter((x) => x !== t));

  const formatDisplay = (t) => {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${dh}:${String(m).padStart(2, '0')} ${ampm}`;
  };

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-3">
        Set the time (or times) of day that work best for you. Lecture reviews and study sessions are booked
        as soon as possible, but only inside a window around one of these times — never anywhere else in the day.
      </p>

      {!loaded ? (
        <div className="h-9 w-40 rounded-lg bg-muted animate-pulse" />
      ) : (
        <>
          {times.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {times.map(t => (
                <span key={t} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-sm">
                  <Clock className="w-3 h-3 text-primary" />
                  {formatDisplay(t)}
                  <button onClick={() => removeTime(t)} className="ml-1 text-muted-foreground hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-center">
            <input
              type="time"
              value={newTime}
              onChange={e => setNewTime(e.target.value)}
              className="px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={addTime}
              disabled={!newTime || saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add Time
            </button>
          </div>

          {times.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2">No preferred times set — sessions default to a late-afternoon/evening window.</p>
          )}
        </>
      )}
    </div>
  );
}
