import React, { useState } from 'react';
import { formatShortDate } from '@/lib/time';
import { lectureTitle } from '@/lib/lectureTitle';
import { Check } from 'lucide-react';

/**
 * LectureScopePicker — choose which lectures a study tool applies to.
 *
 * Checkboxes for individual lectures plus a "Select all" (whole class). The
 * parent owns the selected id list and passes it in; this component just
 * renders and toggles. An empty selection is treated by callers as "whole
 * class" (both study backends expand an empty/absent list to all lectures).
 *
 * Each row says when it was last reviewed, when the parent knows: the same
 * last_reviewed_date the coverage checklist and the freshness badges read.
 * A lecture that has never been reviewed says nothing, on purpose: an empty
 * right-hand side already marks it, and "not reviewed yet" on every row of a
 * new account would be eight reproaches before the student has done a thing.
 *
 * A long list shows its latest lectures and offers the earlier ones on a
 * tap, instead of a scroll box inside the page: a nested scroll on a phone
 * catches the thumb on the way to the tools below, and a class with thirty
 * lectures pushed them off the screen entirely.
 *
 * Props:
 *   lectures      — array of lecture records (already loaded by the parent)
 *   selectedIds   — array of selected lecture ids
 *   reviewedOn    — Map of lecture id -> last reviewed date (optional)
 *   onChange(ids) — called with the new selected id list
 */
const SHOW_LATEST = 8;

export default function LectureScopePicker({ lectures = [], selectedIds = [], reviewedOn = null, onChange }) {
  const [showAll, setShowAll] = useState(false);

  if (lectures.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">No lectures available for this class yet.</p>;
  }

  const allSelected = selectedIds.length === 0 || selectedIds.length === lectures.length;

  const selectAll = () => onChange([]);            // empty = whole class
  const clearAll = () => onChange(['__none__']);   // sentinel: explicitly nothing selected

  const noneSelected = selectedIds.length === 1 && selectedIds[0] === '__none__';
  const effectiveSelected = (id) => allSelected && !noneSelected ? true : (!noneSelected && selectedIds.includes(id));

  const toggleOne = (id) => {
    let base = noneSelected ? [] : (allSelected ? lectures.map(l => l.id) : [...selectedIds]);
    if (base.includes(id)) base = base.filter(x => x !== id);
    else base.push(id);
    if (base.length === 0) onChange(['__none__']);
    else if (base.length === lectures.length) onChange([]); // all -> whole class
    else onChange(base);
  };

  const selectedCount = noneSelected ? 0 : (allSelected ? lectures.length : selectedIds.length);

  // Teaching order is kept; what folds away is the start of the term. A
  // lecture picked by name (the card's "Select the 3 not reviewed yet") is
  // never folded away: a count of three with two rows showing is a puzzle.
  const earlier = lectures.slice(0, Math.max(0, lectures.length - SHOW_LATEST));
  const pickedEarlier = !allSelected && !noneSelected && earlier.some((l) => selectedIds.includes(l.id));
  const folded = !showAll && lectures.length > SHOW_LATEST && !pickedEarlier;
  const visible = folded ? lectures.slice(lectures.length - SHOW_LATEST) : lectures;
  const hiddenCount = lectures.length - visible.length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground tabular-nums">
          {selectedCount === lectures.length ? 'All lectures' : `${selectedCount} of ${lectures.length} selected`}
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={selectAll}
            className={`text-xs font-medium py-2 -my-2 px-1 -mx-1 ${allSelected && !noneSelected ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            Select all
          </button>
          <span className="text-muted-foreground/40">·</span>
          <button type="button" onClick={clearAll}
            className="text-xs font-medium py-2 -my-2 px-1 -mx-1 text-muted-foreground hover:text-foreground">
            Clear
          </button>
        </div>
      </div>

      <div className="space-y-1 rounded-lg border border-border p-2 bg-card">
        {hiddenCount > 0 && (
          <button type="button" onClick={() => setShowAll(true)}
            className="w-full px-2 py-2 rounded-lg text-left text-xs font-medium text-primary hover:bg-muted transition-colors duration-micro">
            Show the {hiddenCount} earlier lecture{hiddenCount === 1 ? '' : 's'}
          </button>
        )}
        {visible.map(l => {
          const on = effectiveSelected(l.id);
          const reviewedDate = reviewedOn ? reviewedOn.get(l.id) : null;
          return (
            <button key={l.id} type="button" onClick={() => toggleOne(l.id)}
              role="checkbox" aria-checked={on}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left hover:bg-muted active:bg-muted transition-colors duration-micro">
              <span className={`w-[18px] h-[18px] rounded border flex items-center justify-center flex-shrink-0 transition-colors duration-micro ${on ? 'bg-primary border-primary' : 'border-border bg-background'}`}>
                {on && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-foreground truncate">{lectureTitle(l)}</span>
                <span className="block text-[11px] text-muted-foreground">{formatShortDate(l.date, { weekday: true })}</span>
              </span>
              {reviewedDate && (
                <span className="text-[11px] text-muted-foreground tabular-nums flex-shrink-0">Reviewed {formatShortDate(reviewedDate)}</span>
              )}
            </button>
          );
        })}
        {showAll && lectures.length > SHOW_LATEST && (
          <button type="button" onClick={() => setShowAll(false)}
            className="w-full px-2 py-2 rounded-lg text-left text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-micro">
            Show only the latest {SHOW_LATEST}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Resolve a scope selection into the lecture_ids to send to the backend.
 * Empty array means "whole class" (send nothing / empty). The '__none__'
 * sentinel means the user explicitly selected nothing.
 */
export function resolveScopeIds(selectedIds, lectures) {
  if (selectedIds.length === 1 && selectedIds[0] === '__none__') return null; // nothing selected
  if (selectedIds.length === 0) return [];                                    // whole class
  return selectedIds.filter(id => id !== '__none__');
}

/**
 * The same selection as an EXPLICIT list of lecture ids, for a caller that
 * has to store what was picked rather than send "whole class" as a shorthand.
 *
 * assignments.lecture_ids is that caller: a deadline with coverage_scope
 * 'custom' stores the lectures it covers, and an empty column there means
 * "nobody has picked yet" (the resolver falls back to cumulative), not "this
 * exam covers nothing". So "select all" has to expand to the real ids, and an
 * explicit empty selection has to collapse back to empty rather than being
 * mistaken for "everything".
 */
export function explicitScopeIds(selectedIds, lectures) {
  const resolved = resolveScopeIds(selectedIds, lectures);
  if (resolved === null) return [];                       // explicitly nothing
  if (resolved.length === 0) return lectures.map(l => l.id); // whole class, written out
  return resolved;
}
