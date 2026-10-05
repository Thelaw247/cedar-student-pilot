import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, GraduationCap } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import EmptyState from '@/components/EmptyState';
import FlashcardViewer from '@/components/FlashcardViewer';
import QuizViewer from '@/components/QuizViewer';
import LectureScopePicker, { resolveScopeIds, explicitScopeIds } from '@/components/LectureScopePicker';
import MaterialScopePicker, { readableMaterials, resolveMaterialIds } from '@/components/MaterialScopePicker';
import StudyToolbox from '@/components/StudyToolbox';
import StudyShelf from '@/components/StudyShelf';
import StudyNextUp from '@/components/StudyNextUp';
import { useStudySession } from '@/study/StudySessionContext';
import { reviewedOn } from '@/lib/studyNextUp';
import { formatShortDate } from '@/lib/time';

/**
 * PracticePanel — the study shelf: pick a class and which of its lectures
 * once, then every tool in the app works on that selection.
 *
 * It started as flashcard/quiz generation only, which is why the review tools
 * lived on the other tab with a second class picker and a second lecture
 * picker of their own. Those are gone; StudyShelf holds them now, above the
 * generation tools, under this one selection.
 *
 * Props:
 *   initialClassId, initialLectureIds — the scope to open with
 *   onScopeChange — report a change back, so the URL holds the selection and
 *     the other tab opens on the same class instead of asking again. Optional:
 *     the panel still works standalone.
 *   allLectures — every lecture the page already loaded, passed through to the
 *     shelf so "today's lectures" can grey itself out when there are none.
 *     Optional, and deliberately not fetched here: an unknown window leaves
 *     the tile live, which is exactly how it behaved before.
 *   deadlines, sessions, coverage — the semester's assignments, scheduled
 *     sessions and knowledge_coverage rows, also from the page, for the card
 *     at the top (what is next for this class) and the "Reviewed Sep 22"
 *     notes on the lecture rows. null while the page is still loading, and
 *     the panel then says nothing about them rather than "0 of 5 reviewed".
 *
 * The professor's files (the class's materials — syllabus, past exams,
 * formula sheets, slides) are a second source for the makers below, chosen
 * per run under the lecture picker. They are the makers' only: the review
 * runners on the shelf take lectures, so the file choice stays here and is
 * not part of the scope reported to the URL.
 */
/** A class's lectures, files, saved flashcards and saved questions, together. */
function readClass(id) {
  return Promise.all([
    base44.entities.Lecture.filter({ class_id: id }, 'date'),
    base44.entities.LectureMaterial.filter({ class_id: id }),
    base44.entities.Flashcard.filter({ class_id: id }),
    base44.entities.PracticeQuestion.filter({ class_id: id }),
  ]);
}

export default function PracticePanel({
  initialClassId = '', initialLectureIds = null, onScopeChange = null, allLectures = null,
  deadlines = null, sessions = null, coverage = null,
}) {
  const navigate = useNavigate();
  const studySession = useStudySession();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(initialClassId || '');
  const [lectures, setLectures] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [scopeIds, setScopeIds] = useState(initialLectureIds && initialLectureIds.length ? initialLectureIds : []);
  const [materialIds, setMaterialIds] = useState([]);
  const [existingFlashcards, setExistingFlashcards] = useState([]);
  const [existingQuestions, setExistingQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Everything the panel shows for one class, in one round trip: the four
  // reads used to run one after the other.
  const showClass = useCallback(async (id) => {
    const [lecs, mats, fc, pq] = await readClass(id);
    setLectures(lecs);
    setMaterials(mats);
    setExistingFlashcards(fc);
    setExistingQuestions(pq);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const semesters = await base44.entities.Semester.filter({ is_active: true });
      if (semesters.length > 0) {
        const cls = await base44.entities.Class.filter({ semester_id: semesters[0].id });
        setClasses(cls);
        const targetId = initialClassId || (cls.length > 0 ? cls[0].id : '');
        setSelectedClass(targetId);
        if (targetId) await showClass(targetId);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [initialClassId, showClass]);

  useEffect(() => { loadData(); }, [loadData]);

  // The selection lives in the URL, and the URL can change under a mounted
  // panel: "Study this" on a booked sitting adopts the session and writes its
  // lectures to the scope. The picker used to keep whatever it had, so the
  // clock said two lectures while the quiz tile said ten. Keyed on the ids
  // as text, so the panel's own writes (which come straight back through
  // the URL) settle in one pass instead of chasing a new array each render.
  const initialKey = (initialLectureIds || []).join(',');
  useEffect(() => {
    setScopeIds(initialKey ? initialKey.split(',') : []);
  }, [initialKey]);

  const loadClassData = async (id) => {
    setSelectedClass(id);
    setScopeIds([]); // reset scope to whole class when switching class
    setMaterialIds([]); // and the file choice to none: another class, other files
    if (onScopeChange) onScopeChange({ classId: id, lectureIds: [] });
    if (id) await showClass(id);
  };

  // The panel owns the scope; the toolbox asks for it at the moment it
  // generates, so a picker the student is still changing cannot be read
  // stale. null means "not a usable selection yet" and the toolbox says so.
  const scopeForGeneration = () => resolveScopeIds(scopeIds, lectures);
  // Same moment, same reason, for the files: only ids that are still readable
  // files of this class are sent.
  const filesForGeneration = () => resolveMaterialIds(materialIds, materials);
  const readableFiles = readableMaterials(materials);

  // The same selection, written out. The review runner is handed lecture ids
  // in a URL and has no "whole class" shorthand to expand — an empty ?ids=
  // there falls through to "today", which is a different set of lectures
  // entirely. `wholeClass` keeps the distinction the handbook cache needs.
  const reviewLectureIds = explicitScopeIds(scopeIds, lectures);
  const wholeClass = resolveScopeIds(scopeIds, lectures)?.length === 0;

  // The card's "Select the 3 not reviewed yet" writes the picker's selection
  // the way the picker itself does: an explicit list, or the whole-class
  // shorthand when the list turns out to be every lecture.
  const pickLectures = (ids) => {
    const next = ids.length >= lectures.length ? [] : ids;
    setScopeIds(next);
    if (onScopeChange) onScopeChange({ lectureIds: next });
  };

  // When each lecture was last reviewed, by the same rule the coverage
  // checklist uses. Unknown until the page's rows arrive.
  const reviewed = Array.isArray(coverage) ? reviewedOn(coverage) : null;
  const reviewedCount = reviewed ? lectures.filter((l) => reviewed.has(l.id)).length : null;
  const dated = lectures.filter((l) => l.date).map((l) => l.date).sort();
  const span = dated.length === 0 ? '' : dated.length === 1 || dated[0] === dated[dated.length - 1]
    ? formatShortDate(dated[0])
    : `${formatShortDate(dated[0])} to ${formatShortDate(dated[dated.length - 1])}`;

  const refreshSaved = async () => {
    if (!selectedClass) return;
    setExistingFlashcards(await base44.entities.Flashcard.filter({ class_id: selectedClass }));
    setExistingQuestions(await base44.entities.PracticeQuestion.filter({ class_id: selectedClass }));
  };

  // Generated material is material the student is now looking at, built from
  // these lectures — by any honest reading, they opened them. That write-
  // through was Focus Mode's; it belongs to the session, which now outlives
  // any one page.
  const onGenerated = async (ids) => {
    await studySession.markOpened(ids);
    await refreshSaved();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="ph-sensitive">
      {/* Class selector */}
      <div className="mb-6">
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Class</label>
        <select value={selectedClass} onChange={e => loadClassData(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
          {classes.length === 0 && <option value="">No classes yet</option>}
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {/* Numbers, not adjectives: how many, from when to when, and how
            many of them have been reviewed at all. */}
        {lectures.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1.5 tabular-nums">
            {lectures.length} lecture{lectures.length === 1 ? '' : 's'}{span ? `, ${span}` : ''}
            {reviewedCount !== null && ` · ${reviewedCount} reviewed`}
          </p>
        )}
      </div>

      {/* The reason to study, before the tools to do it with: the next
          deadline for this class, how much of it is reviewed, and the sitting
          the student booked. Absent when there is nothing true to show. */}
      {selectedClass && lectures.length > 0 && (
        <StudyNextUp
          classId={selectedClass}
          lectures={lectures}
          deadlines={deadlines}
          sessions={sessions}
          coverage={coverage}
          onPickLectures={pickLectures}
        />
      )}

      {/* Lecture scope — which lectures the tools apply to */}
      {selectedClass && lectures.length > 0 && (
        <div className="mb-6">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Study which lectures?</label>
          <LectureScopePicker
            lectures={lectures}
            selectedIds={scopeIds}
            reviewedOn={reviewed}
            onChange={(ids) => {
              setScopeIds(ids);
              if (onScopeChange) onScopeChange({ lectureIds: ids || [] });
            }}
          />
        </div>
      )}

      {/* Nothing to work on yet: one card and one next step, instead of
          five greyed tiles and a toolbox that each explain, in their own
          words, why they cannot run. A brand-new account opened the study
          page and met exactly that. */}
      {(!selectedClass || lectures.length === 0) ? (
        classes.length === 0 ? (
          <EmptyState icon={GraduationCap} title="Add your classes first"
            description="Your lectures, flashcards and quizzes live under your classes. A timetable sets them all up at once."
            action={{ label: 'Set up your classes', icon: GraduationCap, onClick: () => navigate('/classes') }} />
        ) : (
          <EmptyState icon={Mic} title={`Nothing to study in ${classes.find((c) => c.id === selectedClass)?.name || 'this class'} yet`}
            description="Record a lecture and its quiz, handbook, flashcards and practice questions appear here."
            action={{ label: 'Record a lecture', icon: Mic, onClick: () => navigate(`/classes/${selectedClass}?record=1`) }} />
        )
      ) : (
      <>
      {/* Start something now — quiz, handbook, paper guide. */}
      <StudyShelf
        classId={selectedClass}
        lectureIds={reviewLectureIds}
        wholeClass={wholeClass}
        lectureCount={lectures.length}
        hasClasses={classes.length > 0}
        allLectures={allLectures}
      />

      {/* Build something that stays — saved to the class, below. */}
      <h2 className="font-heading text-sm font-semibold text-muted-foreground mb-3">Make study material</h2>

      {/* The professor's files, if the class has any the model could read.
          Chosen per run, none by default: a syllabus folded into every set
          of flashcards unasked would be a surprise, and a run that names no
          files is the request it always was. */}
      {selectedClass && readableFiles.length > 0 && (
        <div className="mb-6">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Also read the professor's files?</label>
          <MaterialScopePicker
            materials={materials}
            lectures={lectures}
            selectedIds={materialIds}
            onChange={setMaterialIds}
          />
          <p className="text-[11px] text-muted-foreground mt-1.5">Same one credit with or without files. Add more on the class page.</p>
        </div>
      )}

      <StudyToolbox
        classId={selectedClass}
        resolveLectureIds={scopeForGeneration}
        resolveMaterialIds={filesForGeneration}
        sourceCount={reviewLectureIds.length}
        fileCount={filesForGeneration().length}
        scopeKey={selectedClass}
        onGenerated={onGenerated}
      />

      {/* Existing materials */}
      {existingFlashcards.length > 0 && (
        <div className="mb-6">
          <h2 className="font-heading text-sm font-semibold text-muted-foreground mb-3">Saved flashcards ({existingFlashcards.length})</h2>
          <FlashcardViewer flashcards={existingFlashcards} />
        </div>
      )}
      {existingQuestions.length > 0 && (
        <div>
          <h2 className="font-heading text-sm font-semibold text-muted-foreground mb-3">Saved questions ({existingQuestions.length})</h2>
          <QuizViewer questions={existingQuestions} />
        </div>
      )}
      </>
      )}
    </div>
  );
}
