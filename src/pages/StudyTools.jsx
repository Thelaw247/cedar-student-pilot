import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Brain, Loader2, Sparkles, Layers, FileQuestion, ClipboardList, FileText, ChevronLeft, CalendarDays, CalendarRange, BookOpen } from 'lucide-react';
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
  const navigate = useNavigate();
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState(classId || '');
  const [lectures, setLectures] = useState([]);
  const [selectedType, setSelectedType] = useState('flashcards');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [existingFlashcards, setExistingFlashcards] = useState([]);
  const [existingQuestions, setExistingQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLecturePicker, setShowLecturePicker] = useState(false);

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
        <h1 className="font-heading text-2xl sm:text-3xl font-bold">Practice</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Turn your lectures into flashcards, quizzes, and practice tests</p>
      </div>

      {/* Lecture-based review section */}
      <div className="mb-8">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Review from Lectures</h2>
        <p className="text-xs text-muted-foreground mb-3">Review questions follow the exact teaching flow — from what the professor covered first to last.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link to="/lecture-review/today"
            className="rounded-xl border border-border bg-card p-4 hover:shadow-2 hover:-translate-y-0.5 transition-all duration-micro group">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-3">
              <CalendarDays className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-sm font-medium text-foreground">Review Today's Lectures</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Go through every lecture from today in teaching order</p>
          </Link>
          <Link to="/lecture-review/week"
            className="rounded-xl border border-border bg-card p-4 hover:shadow-2 hover:-translate-y-0.5 transition-all duration-micro group">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center mb-3">
              <CalendarRange className="w-5 h-5 text-purple-600" />
            </div>
            <h3 className="text-sm font-medium text-foreground">Review This Week</h3>
            <p className="text-xs text-muted-foreground mt-0.5">All lectures from the past 7 days in chronological flow</p>
          </Link>
          <button
            onClick={() => {
              if (!selectedClass) { alert('Select a class first.'); return; }
              if (lectures.length === 0) { alert('No lectures available for this class.'); return; }
              setShowLecturePicker(!showLecturePicker);
            }}
            className="text-left rounded-xl border border-border bg-card p-4 hover:shadow-2 hover:-translate-y-0.5 transition-all duration-micro group w-full">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3">
              <BookOpen className="w-5 h-5 text-emerald-600" />
            </div>
            <h3 className="text-sm font-medium text-foreground">Review by Lecture</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Pick a specific lecture to review</p>
          </button>
        </div>

        {/* Lecture picker */}
        {showLecturePicker && lectures.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 mb-4 animate-fade-in">
            <h3 className="text-sm font-medium text-foreground mb-3">Select a lecture to review:</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {lectures.map(l => (
                <button
                  key={l.id}
                  onClick={() => navigate(`/lecture-review/lecture/${l.id}`)}
                  className="w-full text-left px-3 py-2.5 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/50 transition-colors">
                  <p className="text-sm font-medium text-foreground truncate">{l.ai_title || `Lecture — ${l.date}`}</p>
                  <p className="text-xs text-muted-foreground">{l.date}</p>
                </button>
              ))}
            </div>
          </div>
        )}
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