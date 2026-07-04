import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Brain, Loader2, Sparkles, Layers, FileQuestion, ClipboardList, FileText, ChevronLeft } from 'lucide-react';
import FlashcardViewer from '@/components/FlashcardViewer';
import QuizViewer from '@/components/QuizViewer';

const materialTypes = [
  { id: 'flashcards', label: 'Flashcards', icon: Layers, description: 'Flip cards with key terms and definitions' },
  { id: 'quiz', label: 'Quiz', icon: FileQuestion, description: 'Multiple-choice questions to test knowledge' },
  { id: 'practice_test', label: 'Practice Test', icon: ClipboardList, description: 'Mixed questions covering all lectures' },
  { id: 'summary_sheet', label: 'Summary Sheet', icon: FileText, description: 'Comprehensive study summary by topic' },
];

export default function StudyTools() {
  const { classId } = useParams();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(classId || '');
  const [lectures, setLectures] = useState([]);
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
        const targetId = classId || (cls.length > 0 ? cls[0].id : '');
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
  }, [classId]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadClassData = async (id) => {
    setSelectedClass(id);
    setResult(null);
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
    setGenerating(true);
    setResult(null);
    try {
      const response = await base44.functions.invoke('generateStudyMaterial', {
        class_id: selectedClass,
        material_type: selectedType,
      });
      setResult(response.data);
      // Reload existing materials since new ones were saved
      const fc = await base44.entities.Flashcard.filter({ class_id: selectedClass });
      setExistingFlashcards(fc);
      const pq = await base44.entities.PracticeQuestion.filter({ class_id: selectedClass });
      setExistingQuestions(pq);
    } catch (e) {
      setResult({ error: 'Failed to generate study material. Please try again.' });
    }
    setGenerating(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
      <div className="mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold">Study Tools</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Generate AI flashcards, quizzes, and practice tests from your lectures</p>
      </div>

      {/* Class selector */}
      <div className="mb-6">
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Class</label>
        <select value={selectedClass} onChange={e => loadClassData(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {lectures.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1.5">{lectures.length} lectures available as source material</p>
        )}
      </div>

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

      {/* Generate button */}
      <button onClick={generate} disabled={generating || !selectedClass}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 mb-6">
        {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating from {lectures.length} lectures...</> : <><Sparkles className="w-4 h-4" /> Generate {materialTypes.find(t => t.id === selectedType)?.label}</>}
      </button>

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