import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Trash2, CalendarRange } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { invalidateEntity } from '@/lib/cache';
import { announceDataChange } from '@/lib/dataChanged';

/**
 * Every semester the student has, with the one the app is showing marked.
 *
 * Until this existed, a second timetable import quietly created a second
 * semester and hid the first: nothing listed them, nothing could delete one,
 * and the previous semester's classes, lectures and files lived on behind a
 * page that could not be reached. Delete goes through the API, which removes
 * the recordings and files from storage before the rows go — the same route
 * the class delete takes, widened to the whole semester. There is no undo:
 * the objects are gone, so the confirmation names exactly what goes.
 */
export default function SemestersSection() {
  const [semesters, setSemesters] = useState([]);
  const [counts, setCounts] = useState({}); // semester id -> { classes, lectures, materials }
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(null); // semester id awaiting the second press
  const [deleting, setDeleting] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await base44.entities.Semester.list('-created_date');
      setSemesters(rows);
      if (rows.length === 0) { setCounts({}); setLoading(false); return; }
      // Three reads for the whole page rather than three per semester: the
      // rows are RLS-scoped to this student and counted here by class.
      const [classes, lectures, materials] = await Promise.all([
        base44.entities.Class.list(),
        base44.entities.Lecture.list('-date', 1000),
        base44.entities.LectureMaterial.list(),
      ]);
      const semesterOfClass = {};
      const next = {};
      for (const s of rows) next[s.id] = { classes: 0, lectures: 0, materials: 0 };
      for (const c of classes) {
        semesterOfClass[c.id] = c.semester_id;
        if (next[c.semester_id]) next[c.semester_id].classes += 1;
      }
      for (const l of lectures) {
        const sid = semesterOfClass[l.class_id];
        if (next[sid]) next[sid].lectures += 1;
      }
      for (const m of materials) {
        const sid = semesterOfClass[m.class_id];
        if (next[sid]) next[sid].materials += 1;
      }
      setCounts(next);
    } catch (e) {
      console.error(e);
      setError('Could not load your semesters.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (semester) => {
    setDeleting(semester.id);
    setError('');
    setNotice('');
    try {
      const result = await base44.entities.Semester.delete(semester.id);
      invalidateEntity('Semester');
      invalidateEntity('Class');
      invalidateEntity('Lecture');
      announceDataChange(['Semester', 'Class', 'Lecture', 'ClassAttendance', 'Assignment', 'StudySession']);
      const activated = result && typeof result === 'object' ? result.activated : null;
      setNotice(activated
        ? `Deleted "${semester.name}". "${activated.name}" is now your active semester.`
        : `Deleted "${semester.name}".`);
      setConfirming(null);
      await load();
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Could not delete this semester.');
    }
    setDeleting(null);
  };

  if (loading && semesters.length === 0) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground py-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading semesters…</div>;
  }

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-3">
        The app shows one semester at a time — the active one. Importing a timetable from{' '}
        <Link to="/setup" className="text-primary hover:underline">Set up semester</Link> creates a new active semester; older ones stay here until you delete them.
      </p>

      {semesters.length === 0 ? (
        <p className="text-sm text-muted-foreground">No semesters yet. <Link to="/setup" className="text-primary hover:underline">Set one up</Link>.</p>
      ) : (
        <ul className="space-y-2">
          {semesters.map((s) => {
            const c = counts[s.id] || { classes: 0, lectures: 0, materials: 0 };
            const isConfirming = confirming === s.id;
            const isDeleting = deleting === s.id;
            const summary = [
              `${c.classes} class${c.classes === 1 ? '' : 'es'}`,
              `${c.lectures} lecture${c.lectures === 1 ? '' : 's'}${c.lectures ? ' and their recordings' : ''}`,
              `${c.materials} file${c.materials === 1 ? '' : 's'}`,
            ].join(', ');
            return (
              <li key={s.id} className="rounded-xl border border-border bg-card p-3">
                <div className="flex items-start gap-3">
                  <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <CalendarRange className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                      {s.is_active && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600">Active</span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                      {s.start_date} → {s.end_date} · {summary}
                    </p>
                  </div>
                  {!isConfirming && (
                    <button type="button" onClick={() => { setConfirming(s.id); setNotice(''); setError(''); }}
                      aria-label={`Delete ${s.name}`}
                      className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {isConfirming && (
                  <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <p className="text-xs font-medium text-destructive">Delete "{s.name}" permanently?</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      This removes {summary} — flashcards, questions, attendance and study sessions for those classes go with them.
                      {s.is_active && semesters.length > 1 && ' Your most recent other semester becomes the active one.'}
                      {' '}This can’t be undone.
                    </p>
                    <div className="flex gap-2 mt-2.5">
                      <button type="button" onClick={() => remove(s)} disabled={isDeleting}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 disabled:opacity-50">
                        {isDeleting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting…</> : 'Delete permanently'}
                      </button>
                      <button type="button" onClick={() => setConfirming(null)} disabled={isDeleting}
                        className="px-3 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted">
                        Keep it
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {notice && <p className="text-[11px] text-emerald-600 mt-3">{notice}</p>}
      {error && <p className="text-[11px] text-destructive mt-3">{error}</p>}
    </div>
  );
}
