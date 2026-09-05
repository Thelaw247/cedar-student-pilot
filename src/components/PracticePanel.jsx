import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import FlashcardViewer from '@/components/FlashcardViewer';
import QuizViewer from '@/components/QuizViewer';
import LectureScopePicker, { resolveScopeIds } from '@/components/LectureScopePicker';
import StudyToolbox from '@/components/StudyToolbox';

/**
 * PracticePanel — flashcard / quiz / practice-test generation for a class,
 * plus the class's saved sets. Extracted from the old StudyTools page so it
 * can live inside the Study tab and anywhere else. Self-contained: loads its
 * own classes/lectures/materials.
 *
 * Props:
 *   initialClassId — preselect a class (optional)
 */
export default function PracticePanel({ initialClassId = '', initialLectureIds = null }) {
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
          <LectureScopePicker lectures={lectures} selectedIds={scopeIds} onChange={setScopeIds} />
        </div>
      )}

      <StudyToolbox
        classId={selectedClass}
        resolveLectureIds={scopeForGeneration}
        sourceCount={lectures.length}
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
