import React from 'react';
import LectureScopePicker, { explicitScopeIds } from '@/components/LectureScopePicker';
import { resolveAssignmentLectures, coveragePresetsFor, coverageScopeLabel, deadlineTypeLabel } from '@/lib/assignmentScope';

/**
 * DeadlineCoverage — "what does this exam actually cover?", answered once.
 *
 * Until now the question was a dropdown with three options and a checkbox
 * list that only appeared under one of them, written out twice (the exam form
 * on the home screen and the add form on a class page) with no way to see
 * what the answer resolved to. A student picked "Everything so far", saw
 * nothing, and found out which lectures they'd chosen when the study sessions
 * arrived named after them.
 *
 * So: presets and the list are the same control. The chips set the scope; the
 * list shows exactly what that scope resolves to, using the very function the
 * server resolves it with (shared/assignmentScope.js), so the preview cannot
 * disagree with the booking. Ticking a lecture by hand is what 'custom' is —
 * it is not a mode you select first.
 *
 * Two translations happen here and nowhere else:
 *
 *   scope + lecture_ids  →  the picker's own vocabulary (empty = whole class,
 *                           '__none__' = explicitly nothing)
 *   a manual tick        →  scope 'custom' with the real ids written out,
 *                           except at the two ends: everything ticked means
 *                           'all' (which stays true as the class grows, where
 *                           a frozen list of today's ids would not), and
 *                           nothing ticked means 'none' rather than the empty
 *                           list the resolver reads as "nobody picked yet".
 *
 * Props:
 *   type              exam | quiz | assignment | project — decides the presets
 *   lectures          the class's lectures (parent loads them)
 *   dueDate           what 'cumulative' measures against
 *   scope             current coverage_scope
 *   lectureIds        current assignments.lecture_ids
 *   priorAssignments  other deadlines in the class; only 'since_last' reads them
 *   onChange({ scope, lectureIds })
 */
export default function DeadlineCoverage({
  type = 'assignment',
  lectures = [],
  dueDate = '',
  scope = 'cumulative',
  lectureIds = [],
  priorAssignments = [],
  onChange,
  className = '',
}) {
  const presets = coveragePresetsFor(type);
  const typeLabel = deadlineTypeLabel(type);

  // The resolver ignores an undated lecture, so the picker has to as well:
  // offering a row that can never be part of the answer means "select all"
  // comes back reading "5 of 6" and the control looks broken. The column is
  // NOT NULL, so this is a guard rather than an expected case.
  const dated = lectures.filter((l) => l && l.date);

  // The same call the scheduler and the handbook make, so what is ticked below
  // is what those two will use.
  const covered = resolveAssignmentLectures(
    { id: '__draft__', due_date: dueDate, coverage_scope: scope, lecture_ids: lectureIds },
    dated,
    priorAssignments,
  );
  const coveredIds = covered.map((l) => l.id);

  // → the picker's vocabulary.
  const selectedIds = coveredIds.length === 0
    ? ['__none__']
    : coveredIds.length === dated.length
      ? []
      : coveredIds;

  const handlePick = (ids) => {
    const explicit = explicitScopeIds(ids, dated);
    if (explicit.length === 0) return onChange({ scope: 'none', lectureIds: [] });
    if (explicit.length === dated.length) {
      // Ticking everything means 'all' — a live answer that keeps tracking a
      // class as it grows, where a frozen list of today's ids would not. But
      // if the scope already in force covers all of them, this is a student
      // pressing "Select all" to undo one untick, and turning their exam's
      // 'cumulative' into 'all' behind them would quietly widen it to
      // lectures taught after the exam the next time they record.
      if (coveredIds.length === dated.length) return;
      return onChange({ scope: 'all', lectureIds: [] });
    }
    onChange({ scope: 'custom', lectureIds: explicit });
  };

  return (
    <div className={className}>
      <p className="text-xs font-medium text-muted-foreground mb-2">What this {typeLabel} covers</p>

      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {presets.map((p) => {
          const on = scope === p;
          return (
            <button key={p} type="button" onClick={() => onChange({ scope: p, lectureIds: [] })}
              aria-pressed={on}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors duration-micro ${
                on ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
              {coverageScopeLabel(p, type)}
            </button>
          );
        })}
        {/* Whatever the scope is, if it is not one of the chips above it
            still has to be legible — otherwise every chip reads off and the
            control looks broken. That is 'custom' the moment a student ticks
            a lecture, and it is also a deadline saved under a scope this type
            no longer offers: the dropdown this replaces listed all of them
            for every type, so an assignment stored as 'since_last' exists. */}
        {!presets.includes(scope) && (
          <span className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-primary bg-primary text-primary-foreground">
            {coverageScopeLabel(scope, type)}
          </span>
        )}
      </div>

      {dated.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No lectures recorded for this class yet — whatever you choose here fills in as you record.
        </p>
      ) : (
        <>
          {/* The list is rendered even for 'none', with nothing ticked, so
              "it covers these" and "it covers none of these" are the same
              picture rather than two different screens — and ticking one is
              how a student changes their mind. */}
          <LectureScopePicker lectures={dated} selectedIds={selectedIds} onChange={handlePick} />
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {scope === 'none'
              ? `Not tied to any of this class's ${dated.length} lecture${dated.length === 1 ? '' : 's'} — tick one to change that.`
              : <>
                {coveredIds.length} of {dated.length} lecture{dated.length === 1 ? '' : 's'}
                {covered.length > 0 && ` · ${covered[0].date} → ${covered[covered.length - 1].date}`}
              </>}
          </p>
        </>
      )}
    </div>
  );
}

/**
 * The coverage a form starts a lecture-less class with, and the one-liner a
 * collapsed row shows before anyone opens the control.
 */
export function coverageSummary(scope, type, coveredCount) {
  if (scope === 'none') return 'No lectures';
  if (scope === 'custom') return `${coveredCount} lecture${coveredCount === 1 ? '' : 's'}`;
  return coverageScopeLabel(scope, type);
}
