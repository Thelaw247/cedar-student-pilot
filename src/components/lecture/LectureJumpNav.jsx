import React from 'react';
import { scrollToSection } from './lectureStudy';

/**
 * The skim bar: one chip per section with its count, sticky under the app
 * header, scrolls horizontally on phones. A student lands on a lecture and
 * sees in one line what it contains — 14 concepts, 6 formulas (4 verified),
 * 3 exam notes, 2 to-dos — and taps straight to the one they need.
 */
export default function LectureJumpNav({ items }) {
  const visible = items.filter((i) => i.count !== 0 && i.count !== null);
  if (visible.length < 2) return null;
  return (
    <nav aria-label="Jump to section" className="sticky top-0 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 mb-4 glass-chrome border-b">
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
        {visible.map((i) => (
          <button key={i.id} type="button" onClick={() => scrollToSection(i.id)}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-card text-[12px] font-medium text-foreground hover:border-primary/40 hover:text-primary transition-colors">
            {i.label}
            {typeof i.count === 'number' && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground tabular-nums">{i.count}</span>}
          </button>
        ))}
      </div>
    </nav>
  );
}
