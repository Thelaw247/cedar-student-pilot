import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Sparkles, Layers, FileQuestion, ClipboardList, FileText, Lock } from 'lucide-react';
import FlashcardViewer from '@/components/FlashcardViewer';
import QuizViewer from '@/components/QuizViewer';
import { useFeatureGate } from '@/components/monetization/useFeatureGate';

/**
 * The four things Praelecta can build from a set of lectures, and the one
 * place that builds them.
 *
 * Extracted from PracticePanel rather than reimplemented: the Practice tab
 * had all four and a focus session had none, so a student who had committed
 * an hour to studying got the fewest tools in the app. A second copy inside
 * FocusMode would have been two generate buttons drifting apart — this is the
 * same component in both places, and the Practice tab keeps its own tests.
 *
 * The caller owns the scope. PracticePanel resolves it from its lecture
 * picker; a focus session already knows it from the session it opened. Hence
 * `resolveLectureIds` as a function rather than a value: it is asked at the
 * moment of generating, so a picker the student is still changing cannot be
 * read stale.
 *
 * Props:
 *   classId            the class to generate from
 *   resolveLectureIds  () => string[] | null. [] means the whole class (what
 *                      generateStudyMaterial reads as "no subset"); null means
 *                      the caller's selection is not usable yet.
 *   sourceCount        how many lectures are in scope, for the button label
 *   scopeKey           changes when the result stops belonging to what is on
 *                      screen — switching class, opening a different session.
 *                      Clears the result without remounting, which would also
 *                      throw away the tool the student had chosen.
 *   onGenerated        called with the lecture ids the material was built
 *                      from, after a successful run. PracticePanel uses it to
 *                      refresh its saved lists; a focus session uses it to
 *                      record which lectures were opened.
 */

const materialTypes = [
  { id: 'flashcards', label: 'Flashcards', icon: Layers, description: 'Flip cards with key terms and definitions' },
  { id: 'quiz', label: 'Quiz', icon: FileQuestion, description: 'Multiple-choice questions to test knowledge' },
  { id: 'practice_test', label: 'Practice Test', icon: ClipboardList, description: 'Mixed questions covering all lectures' },
  { id: 'summary_sheet', label: 'Summary Sheet', icon: FileText, description: 'Comprehensive study summary by topic' },
];

export default function StudyToolbox({ classId, resolveLectureIds, sourceCount = 0, scopeKey = null, onGenerated = null }) {
  const { allowed: practiceAllowed, requiredTierName: practiceTierName, lock: practiceLock } = useFeatureGate('study_material');
  const [selectedType, setSelectedType] = useState('flashcards');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);

  // Material generated for one class is not material for the next one.
  useEffect(() => { setResult(null); }, [scopeKey]);

  const generate = async () => {
    if (!classId) return;
    const ids = resolveLectureIds ? resolveLectureIds() : [];
    if (ids === null) { setResult({ error: 'Select at least one lecture (or choose Select all).' }); return; }
    setGenerating(true);
    setResult(null);
    try {
      const response = await base44.functions.invoke('generateStudyMaterial', {
        class_id: classId,
        material_type: selectedType,
        lecture_ids: ids, // [] = whole class; otherwise the chosen subset
      });
      setResult(response.data);
      // Material a student is now looking at, built from these lectures: by
      // any honest reading, they opened them. [] means the whole class, so
      // report nothing rather than guessing which lectures that was — the
      // caller knows its own scope.
      if (onGenerated) await onGenerated(ids);
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

  return (
    <div>
      {/* Material type selector */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {materialTypes.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} type="button" onClick={() => setSelectedType(t.id)}
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
        <button type="button" onClick={practiceLock}
          className="w-full py-3 rounded-xl bg-muted text-muted-foreground text-sm font-medium hover:text-foreground transition-colors flex items-center justify-center gap-2 mb-6">
          <Lock className="w-4 h-4" /> Upgrade to use — practice generation ships with {practiceTierName}
        </button>
      ) : (
      <button type="button" onClick={generate} disabled={generating || !classId}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 mb-6">
        {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating from {sourceCount} lectures...</> : <><Sparkles className="w-4 h-4" /> Generate {materialTypes.find(t => t.id === selectedType)?.label}</>}
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
    </div>
  );
}
