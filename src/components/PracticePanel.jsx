import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, Sparkles, Layers, FileQuestion, ClipboardList, FileText } from 'lucide-react';
import FlashcardViewer from '@/components/FlashcardViewer';
import QuizViewer from '@/components/QuizViewer';
import LectureScopePicker, { resolveScopeIds } from '@/components/LectureScopePicker';
import { useFeatureGate } from '@/components/monetization/useFeatureGate';
import { Lock } from 'lucide-react';

const materialTypes = [
  { id: 'flashcards', label: 'Flashcards', icon: Layers, description: 'Flip cards with key terms and definitions' },
  { id: 'quiz', label: 'Quiz', icon: FileQuestion, description: 'Multiple-choice questions to test knowledge' },
  { id: 'practice_test', label: 'Practice Test', icon: ClipboardList, description: 'Mixed questions covering all lectures' },
  { id: 'summary_sheet', label: 'Summary Sheet', icon: FileText, description: 'Comprehensive study summary by topic' },
];

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
  const { allowed: practiceAllowed, requiredTierName: practiceTierName, lock: practiceLock } = useFeatureGate('study_material');
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(initialClassId || '');
  const [lectures, setLectures] = useState([]);
  const [scopeIds, setScopeIds] = useState(initialLectureIds && initialLectureIds.length ? initialLectureIds : []);
  const [selectedType, setSelectedType] = useState('flashcards');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
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
    setResult(null);
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

  const generate = async () => {
    if (!selectedClass) return;
    const ids = resolveScopeIds(scopeIds, lectures);
    if (ids === null) { setResult({ error: 'Select at least one lecture (or choose Select all).' }); return; }
    setGenerating(true);
    setResult(null);
    try {
      const response = await base44.functions.invoke('generateStudyMaterial', {
        class_id: selectedClass,
        material_type: selectedType,
        lecture_ids: ids, // [] = whole class; otherwise the chosen subset
      });
      setResult(response.data);
      const fc = await base44.entities.Flashcard.filter({ class_id: selectedClass });
      setExistingFlashcards(fc);
      const pq = await base44.entities.PracticeQuestion.filter({ class_id: selectedClass });
      setExistingQuestions(pq);
    } catch (e) {
      // Show what the server said when it said something. The generic line
      // below hid a NOT NULL violation for two weeks: the student read
      // "try again", tried again, and got the same thing.
      const status = e?.response?.status;
      const said = e?.response?.data?.message || e?.response?.data?.error;
      setResult({
        error: status === 402
          ? (said || 'This needs an upgrade or more credits.')
          : (said || 'Failed to generate study material. Please try again.'),
      });
    }
    setGenerating(false);
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

      {/* Material type selector */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {materialTypes.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setSelectedType(t.id)}
              className={`text-left p-4 rounded-xl border transition-all ${selectedType === t.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/30'}`}>
              <Icon className={`w-5 h-5 mb-2 ${selectedType === t.id ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className="text-sm font-medium text-foreground">{t.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
            </button>
          );
        })}
      </div>

      {/* Generate button — grey lock below Student (server re-enforces) */}
      {!practiceAllowed ? (
        <button onClick={practiceLock}
          className="w-full py-3 rounded-xl bg-muted text-muted-foreground text-sm font-medium hover:text-foreground transition-colors flex items-center justify-center gap-2 mb-6">
          <Lock className="w-4 h-4" /> Upgrade to use — practice generation ships with {practiceTierName}
        </button>
      ) : (
      <button onClick={generate} disabled={generating || !selectedClass}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 mb-6">
        {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating from {lectures.length} lectures...</> : <><Sparkles className="w-4 h-4" /> Generate {materialTypes.find(t => t.id === selectedType)?.label}</>}
      </button>
      )}

      {/* Generated result */}
      {result && !result.error && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground">Just Generated</h2>
          </div>
          {selectedType === 'flashcards' && result.material?.flashcards && (
            <FlashcardViewer flashcards={result.material.flashcards} />
          )}
          {(selectedType === 'quiz' || selectedType === 'practice_test') && result.material?.questions && (
            <QuizViewer questions={result.material.questions} />
          )}
          {selectedType === 'summary_sheet' && result.material?.summary && (
            <div className="rounded-xl border border-border bg-card p-5">
              <pre className="text-sm text-foreground whitespace-pre-wrap font-body">{result.material.summary}</pre>
            </div>
          )}
        </div>
      )}
      {result?.error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 mb-6">
          <p className="text-sm text-destructive">{result.error}</p>
        </div>
      )}

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
