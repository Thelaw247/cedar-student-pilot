import React from 'react';
import { Check, FileText } from 'lucide-react';

/**
 * MaterialScopePicker — choose which of the professor's files a study tool
 * reads, next to the lectures it reads.
 *
 * The sibling of LectureScopePicker with the opposite default: nothing is
 * chosen until the student chooses it. Lectures are what the tools have
 * always built from, so "all of them" is the natural resting state there;
 * files are an addition, and a syllabus quietly folded into every set of
 * flashcards would be a surprise. So the parent holds an explicit id list,
 * [] means none, and there is no "whole class" shorthand to resolve.
 *
 * Only files with readable text are offered — a scanned PDF the model could
 * not read is kept for download on the class page and is not a source. A
 * file attached to one lecture is listed with that lecture's name, so the
 * student knows which past exam this is.
 *
 * Props:
 *   materials     — the class's lecture_materials rows (any status; filtered here)
 *   lectures      — the class's lectures, for labelling lecture-attached files
 *   selectedIds   — chosen material ids
 *   onChange(ids) — called with the new chosen id list
 */
export default function MaterialScopePicker({ materials = [], lectures = [], selectedIds = [], onChange }) {
  const readable = readableMaterials(materials);
  if (readable.length === 0) return null;

  const chosen = new Set(selectedIds);
  const lectureById = new Map((lectures || []).map((l) => [l.id, l]));
  const from = (m) => {
    if (!m.lecture_id) return null;
    const l = lectureById.get(m.lecture_id);
    return l ? (l.ai_title || `Lecture — ${l.date}`) : 'a lecture';
  };

  const toggle = (id) => onChange(chosen.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  const count = readable.filter((m) => chosen.has(m.id)).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground">
          {count === 0 ? 'None chosen' : count === readable.length ? 'All files' : `${count} of ${readable.length} chosen`}
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onChange(readable.map((m) => m.id))}
            className={`text-xs font-medium py-2 -my-2 px-1 -mx-1 ${count === readable.length ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            Select all
          </button>
          <span className="text-muted-foreground/40">·</span>
          <button type="button" onClick={() => onChange([])}
            className="text-xs font-medium py-2 -my-2 px-1 -mx-1 text-muted-foreground hover:text-foreground">
            Clear
          </button>
        </div>
      </div>

      <div className="space-y-1.5 max-h-64 overflow-y-auto rounded-lg border border-border p-2 bg-card">
        {readable.map((m) => {
          const on = chosen.has(m.id);
          const lecture = from(m);
          return (
            <button key={m.id} type="button" onClick={() => toggle(m.id)}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left hover:bg-muted transition-colors">
              <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${on ? 'bg-primary border-primary' : 'border-border'}`}>
                {on && <Check className="w-3 h-3 text-primary-foreground" strokeWidth={3} />}
              </span>
              <FileText className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm text-foreground truncate">{m.file_name}</span>
                <span className="block text-[11px] text-muted-foreground truncate">
                  {m.page_count ? `${m.page_count} pages` : 'Text'}{lecture ? ` · from ${lecture}` : ' · course file'}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The files a tool can read: extracted text is what the generator is sent. */
export function readableMaterials(materials) {
  return (materials || []).filter((m) => m.extraction_status === 'ready');
}

/**
 * The chosen ids that are still readable files of this class — a file
 * deleted since it was ticked, or one from the class the student switched
 * away from, is not sent.
 */
export function resolveMaterialIds(selectedIds, materials) {
  const readable = new Set(readableMaterials(materials).map((m) => m.id));
  return (selectedIds || []).filter((id) => readable.has(id));
}
