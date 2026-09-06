import React, { useState } from 'react';
import { Check, ChevronDown, ChevronRight, Circle } from 'lucide-react';
import FreshnessBadge from '@/components/FreshnessBadge';
import { getDecayState } from '@/lib/conceptDecay';
import { resolveAssignmentLectures } from '@/lib/assignmentScope';

/**
 * What this deadline covers, and what you have actually got through.
 *
 * The end of the chain the last six phases built. A deadline resolves to a set
 * of lectures (phase 1), its sessions each take a share of them (phase 2), a
 * focus session opens the ones it covers (phases 3 and 4), and finishing one
 * marks them reviewed (phase 5). Until this component there was nowhere a
 * student could see the result — the app knew exactly which four of nine
 * lectures were still untouched and had no way to say so.
 *
 * COVERED MEANS REVIEWED, AND NOTHING NEW
 *
 * A lecture is ticked when knowledge_coverage says it has a last_reviewed_date.
 * That is the same row the freshness badges on a lecture card read and the same
 * row the proficiency ring reads — deliberately, because a checklist with its
 * own private idea of "covered" would be the fourth meaning of the word in one
 * app. It also means the badges here and on the lecture itself can never
 * disagree.
 *
 * The badge is worth more than the tick on its own: a lecture reviewed in
 * August and a lecture reviewed yesterday are both ticked, and only one of them
 * is worth walking into an exam on.
 *
 * Props:
 *   assignment        the deadline
 *   lectures          the class's lectures (any order)
 *   priorAssignments  other deadlines in the class, for 'since_last'
 *   coverage          knowledge_coverage rows for the class
 *   defaultOpen       expand on mount, for a page with room for it
 */
export default function CoverageChecklist({
  assignment,
  lectures = [],
  priorAssignments = [],
  coverage = [],
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen);

  const scoped = resolveAssignmentLectures(assignment, lectures, priorAssignments);
  if (scoped.length === 0) return null;

  const byLecture = {};
  for (const row of coverage) if (row?.lecture_id) byLecture[row.lecture_id] = row;

  const rows = scoped.map((lecture) => {
    const cov = byLecture[lecture.id];
    return {
      lecture,
      covered: !!cov?.last_reviewed_date,
      decay: getDecayState(cov, lectures, lecture),
    };
  });
  const done = rows.filter((r) => r.covered).length;
  const pct = Math.round((done / rows.length) * 100);

  return (
    <div className="mt-3 pt-3 border-t border-border">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="w-full flex items-center gap-2 text-left group"
      >
        {open
          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
        <span className="text-xs font-medium text-foreground">
          {done} of {rows.length} lecture{rows.length === 1 ? '' : 's'} covered
        </span>
        {/* A bar rather than a second number: the count above already says it,
            and at a glance the length is the thing being read. */}
        <span className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[7rem]">
          <span
            className="block h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </span>
      </button>

      {open && (
        <ul className="mt-2.5 space-y-1.5">
          {rows.map(({ lecture, covered, decay }) => (
            <li key={lecture.id} className="flex items-center gap-2">
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                  covered ? 'bg-primary' : 'border border-border'
                }`}
              >
                {covered
                  ? <Check className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3.5} />
                  : <Circle className="w-0 h-0" />}
              </span>
              <span className={`text-xs truncate ${covered ? 'text-foreground' : 'text-muted-foreground'}`}>
                {lecture.ai_title || `Lecture — ${lecture.date}`}
              </span>
              {/* Only where there is something to say. An unreviewed lecture is
                  already marked by its empty circle; a second grey chip beside
                  it is noise. */}
              {covered && <FreshnessBadge decayState={decay} compact />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
