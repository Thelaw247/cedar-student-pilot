import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import FlashcardViewer from '@/components/FlashcardViewer';
import QuizViewer from '@/components/QuizViewer';
import LectureScopePicker, { resolveScopeIds, explicitScopeIds } from '@/components/LectureScopePicker';
import StudyToolbox from '@/components/StudyToolbox';
import StudyShelf from '@/components/StudyShelf';

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
 */
export default function PracticePanel({ initialClassId = '', initialLectureIds = null, onScopeChange = null, allLectures = null }) {
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(initialClassId || '');
  const [lectures, setLectures] = useState([]);
  const [scopeIds, setScopeIds] = useState(initialLectureIds && initialLectureIds.length ? initialLectureIds : []);
  const [existingFlashcards, setExistingFlashcards] = useState([]);
  const [existingQuestions, setExistingQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const semesters = await base44.entities.Semester.filter({ is_active: true });
      if (semesters.length > 0) {
        const cls = await base44.entities.Class.filter({ semester_id: semesters[0].id });
        setClasses(cls);
        const targetId = initialClassId || (cls.length > 0 ? cls[0].id : '');
        setSelectedClass(targetId);
        if (targetId) {
          const lecs = await base44.entities.Lecture.filter({ class_id: targetId }, 'date');
          setLectures(lecs);
          const fc = await base44.entities.Flashcard.filter({ class_id: targetId });
          setExistingFlashcards(fc);
          const pq = await base44.entities.PracticeQuestion.filter({ class_id: targetId });
          setExistingQuestions(pq);
        }
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [initialClassId]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadClassData = async (id) => {
    setSelectedClass(id);
    setScopeIds([]); // reset scope to whole class when switching class
    if (onScopeChange) onScopeChange({ classId: id, lectureIds: [] });
    if (id) {
      const lecs = await base44.entities.Lecture.filter({ class_id: id }, 'date');
      setLectures(lecs);
      const fc = await base44.entities.Flashcard.filter({ class_id: id });
      setExistingFlashcards(fc);
      const pq = await base44.entities.PracticeQuestion.filter({ class_id: id });
      setExistingQuestions(pq);
    }
  };

  // The panel owns the scope; the toolbox asks for it at the moment it
  // generates, so a picker the student is still changing cannot be read
  // stale. null means "not a usable selection yet" and the toolbox says so.
  const scopeForGeneration = () => resolveScopeIds(scopeIds, lectures);

  // The same selection, written out. The review runner is handed lecture ids
  // in a URL and has no "whole class" shorthand to expand — an empty ?ids=
  // there falls through to "today", which is a different set of lectures
  // entirely. `wholeClass` keeps the distinction the handbook cache needs.
  const reviewLectureIds = explicitScopeIds(scopeIds, lectures);
  const wholeClass = resolveScopeIds(scopeIds, lectures)?.length === 0;

  const refreshSaved = async () => {
    if (!selectedClass) return;
    setExistingFlashcards(await base44.entities.Flashcard.filter({ class_id: selectedClass }));
    setExistingQuestions(await base44.entities.PracticeQuestion.filter({ class_id: selectedClass }));
  };

  if (loading) {
    return <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin"></div></div>;
  }

  return (
    <div>
      {/* Class selector */}
      <div className="mb-6">
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Class</label>
        <select value={selectedClass} onChange={e => loadClassData(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
          {classes.length === 0 && <option value="">No classes yet</option>}
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {lectures.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1.5">{lectures.length} lectures available as source material</p>
        )}
      </div>

      {/* Lecture scope — which lectures the tools apply to */}
      {selectedClass && lectures.length > 0 && (
        <div className="mb-6">
          <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Study which lectures?</label>
          <LectureScopePicker
            lectures={lectures}
            selectedIds={scopeIds}
            onChange={(ids) => {
              setScopeIds(ids);
              if (onScopeChange) onScopeChange({ lectureIds: ids || [] });
            }}
          />
        </div>
      )}

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
      <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Make study material</h2>
      <StudyToolbox
        classId={selectedClass}
        resolveLectureIds={scopeForGeneration}
        sourceCount={reviewLectureIds.length}
        scopeKey={selectedClass}
        onGenerated={refreshSaved}
      />

      {/* Existing materials */}
      {existingFlashcards.length > 0 && (
        <div className="mb-6">
          <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Saved Flashcards ({existingFlashcards.length})</h2>
          <FlashcardViewer flashcards={existingFlashcards} />
        </div>
      )}
      {existingQuestions.length > 0 && (
        <div>
          <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Saved Questions ({existingQuestions.length})</h2>
          <QuizViewer questions={existingQuestions} />
        </div>
      )}
    </div>
  );
}
