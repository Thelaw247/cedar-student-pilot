import React from 'react';
import { Check } from 'lucide-react';

/**
 * LectureScopePicker — choose which lectures a study tool applies to.
 *
 * Checkboxes for individual lectures plus a "Select all" (whole class). The
 * parent owns the selected id list and passes it in; this component just
 * renders and toggles. An empty selection is treated by callers as "whole
 * class" (both study backends expand an empty/absent list to all lectures).
 *
 * Props:
 *   lectures      — array of lecture records (already loaded by the parent)
 *   selectedIds   — array of selected lecture ids
 *   onChange(ids) — called with the new selected id list
 */
export default function LectureScopePicker({ lectures = [], selectedIds = [], onChange }) {
  if (lectures.length === 0) {
    return <p className="text-xs text-muted-foreground py-2">No lectures available for this class yet.</p>;
  }

  const allSelected = selectedIds.length === 0 || selectedIds.length === lectures.length;

  const toggleAll = () => {
    // Selecting all is represented as an empty list (= whole class).
    if (allSelected) onChange(lectures.map(l => l.id)); // switch to explicit none-yet? No: select none
    else onChange([]);
  };

  // Clearer explicit handlers:
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

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground">
          {selectedCount === lectures.length ? 'All lectures' : `${selectedCount} of ${lectures.length} selected`}
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={selectAll}
            className={`text-xs font-medium ${allSelected && !noneSelected ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            Select all
          </button>
          <span className="text-muted-foreground/40">·</span>
          <button type="button" onClick={clearAll}
            className="text-xs font-medium text-muted-foreground hover:text-foreground">
            Clear
          </button>
        </div>
      </div>

      <div className="space-y-1.5 max-h-64 overflow-y-auto rounded-lg border border-border p-2 bg-card">
        {lectures.map(l => {
          const on = effectiveSelected(l.id);
          return (
            <button key={l.id} type="button" onClick={() => toggleOne(l.id)}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left hover:bg-muted transition-colors">
              <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${on ? 'bg-primary border-primary' : 'border-border'}`}>
                {on && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-foreground truncate">{l.ai_title || `Lecture — ${l.date}`}</span>
                <span className="block text-[11px] text-muted-foreground">{l.date}</span>
              </span>
            </button>
          );
        })}
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
