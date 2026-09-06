import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, ClipboardList, ListChecks, CalendarDays, CalendarRange, Lock } from 'lucide-react';
import { useFeatureGate } from '@/components/monetization/useFeatureGate';
import HandbookReader from '@/components/HandbookReader';
import ManualStudyGuide from '@/components/ManualStudyGuide';
import { localDay, daysAgo } from '@/lib/localDay';
import { scopeBlockReason, windowBlockReason } from '@/lib/studyShelf';

/**
 * Every way to study these lectures, on one shelf, with nothing to answer.
 *
 * The review tools used to live on the Plan tab, behind a second class picker
 * and a second lecture picker of their own — so a student who had already
 * chosen BIO 120 and three lectures on the Practice tab was asked both
 * questions again to quiz themselves on exactly that. And "Review" landed on
 * a fork ("quiz or handbook?") rather than on anything to read.
 *
 * So the fork is gone and the second picker is gone. The scope is chosen once,
 * above; every tile here works on it.
 *
 * The two kinds of tool are deliberately kept apart, because they are not the
 * same act:
 *
 *   this shelf   starts something you do now — a quiz, a handbook, a guide
 *   StudyToolbox builds material that is saved to the class and stays there
 *
 * A tool that cannot run is shown greyed WITH ITS REASON rather than hidden or
 * left live. Two reasons account for almost all of it in the live data: the
 * handbook needs Scholar (twelve refusals logged on one account in a single
 * day), and "today's lectures" is empty most days — the newest lecture is
 * rarely dated today, and the button spent a tap and a page load to say so.
 *
 * Props:
 *   classId      the class in scope
 *   lectureIds   the scope as an EXPLICIT id list. [] means there is nothing
 *                usable selected — never "everything", which is what an empty
 *                list means to the generation backends.
 *   wholeClass   true when that list is every lecture in the class. The
 *                handbook caches per scope ('full' vs a sorted id list), so
 *                sending the ids for a whole-class handbook would miss the
 *                cache row it already has and regenerate it — at cost.
 *   lectureCount how many lectures the class has, so "nothing selected" and
 *                "nothing to select" can be told apart in the reason.
 *   hasClasses   whether there is a class to pick at all — "pick a class" is a
 *                lie on an account that has none.
 *   allLectures  every lecture the planner loaded, used only to decide whether
 *                today's / this week's review has anything to work on. null
 *                means not known, and an unknown window stays live: the runner
 *                answers honestly, and grey-when-unsure would be a new bug.
 */
export default function StudyShelf({
  classId,
  lectureIds = [],
  wholeClass = false,
  lectureCount = 0,
  hasClasses = true,
  allLectures = null,
}) {
  const navigate = useNavigate();
  const review = useFeatureGate('lecture_review');
  const handbook = useFeatureGate('handbook');
  // The handbook and the paper guide are two readings of the same generated
  // material (both call generateClassHandbook), so they share its gate.
  const [overlay, setOverlay] = useState(null); // 'handbook' | 'guide' | null

  const scopeReason = scopeBlockReason({ classId, lectureCount, lectureIds, hasClasses });
  const today = localDay();
  const weekFrom = daysAgo(7);

  // The handbook and guide read the scope the way their backend does: an
  // absent list means the whole class, which is a different (already cached)
  // handbook from the same lectures listed out one by one.
  const scopedIds = wholeClass ? null : lectureIds;

  return (
    <div className="mb-8">
      <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Study the lectures you picked</h2>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <Tile
          icon={ListChecks} tint="text-emerald-600"
          title="Quiz me"
          desc="Question by question, in teaching order"
          lockedTierName={review.allowed ? null : review.requiredTierName}
          onLock={review.lock}
          disabledReason={scopeReason}
          onClick={() => navigate(`/lecture-review?ids=${lectureIds.join(',')}&mode=quiz`)}
        />
        <Tile
          icon={BookOpen} tint="text-amber-600"
          title="Handbook"
          desc="Your lectures as chapters, each with a quiz"
          lockedTierName={handbook.allowed ? null : handbook.requiredTierName}
          onLock={handbook.lock}
          disabledReason={scopeReason}
          onClick={() => setOverlay('handbook')}
        />
        <Tile
          icon={ClipboardList} tint="text-sky-600"
          title="Paper guide"
          desc="Topics to work through on paper"
          lockedTierName={handbook.allowed ? null : handbook.requiredTierName}
          onLock={handbook.lock}
          disabledReason={scopeReason}
          onClick={() => setOverlay('guide')}
        />
      </div>

      {/* Kept apart on purpose. Everything above works on the selection made
          at the top of the page; these two ignore it and go by date, across
          every class — which is the honest thing to say rather than letting a
          student wonder why "today" disregarded the three lectures they
          picked. */}
      <h3 className="text-xs font-medium text-muted-foreground mb-2">Or catch up across every class</h3>
      <div className="grid grid-cols-2 gap-3">
        <Tile
          icon={CalendarDays} tint="text-blue-600"
          title="Today's lectures"
          desc="Everything recorded today"
          lockedTierName={review.allowed ? null : review.requiredTierName}
          onLock={review.lock}
          disabledReason={windowBlockReason(allLectures, today, today, 'dated today')}
          onClick={() => navigate('/lecture-review/today?mode=quiz')}
        />
        <Tile
          icon={CalendarRange} tint="text-purple-600"
          title="This week"
          desc="Everything from the past 7 days"
          lockedTierName={review.allowed ? null : review.requiredTierName}
          onLock={review.lock}
          disabledReason={windowBlockReason(allLectures, weekFrom, today, 'in the past 7 days')}
          onClick={() => navigate('/lecture-review/week?mode=quiz')}
        />
      </div>

      {overlay === 'handbook' && classId && (
        <HandbookReader classId={classId} lectureIds={scopedIds} onClose={() => setOverlay(null)} />
      )}
      {overlay === 'guide' && classId && (
        <ManualStudyGuide
          classId={classId}
          lectureIds={scopedIds || undefined}
          onClose={() => setOverlay(null)}
        />
      )}
    </div>
  );
}

/**
 * One tool, in one of three states.
 *
 * A tool the student cannot use is visible and greyed with the reason on it —
 * never hidden (they would go looking for it) and never live-until-tapped
 * (that is the dead end). A tier lock is the one greyed state that is still
 * pressable, because there is something to press: the upgrade sheet.
 */
function Tile({ icon: Icon, tint, title, desc, lockedTierName = null, onLock = null, disabledReason = null, onClick }) {
  if (lockedTierName) {
    return (
      <button type="button" onClick={onLock}
        className="text-left p-4 rounded-xl border border-border bg-muted/40 hover:bg-muted transition-colors duration-micro">
        <Lock className="w-5 h-5 mb-2 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Unlocks with {lockedTierName} — tap to upgrade</p>
      </button>
    );
  }
  if (disabledReason) {
    return (
      <div aria-disabled="true"
        className="text-left p-4 rounded-xl border border-dashed border-border bg-muted/20 opacity-70 cursor-not-allowed">
        <Icon className="w-5 h-5 mb-2 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{disabledReason}</p>
      </div>
    );
  }
  return (
    <button type="button" onClick={onClick}
      className="text-left p-4 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-2 hover:-translate-y-0.5 transition-all duration-micro">
      <Icon className={`w-5 h-5 mb-2 ${tint}`} />
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
    </button>
  );
}
