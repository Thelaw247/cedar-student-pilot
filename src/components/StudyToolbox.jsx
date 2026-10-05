import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, Sparkles, Layers, ClipboardList, FileText, Lock, Check } from 'lucide-react';
import FlashcardViewer from '@/components/FlashcardViewer';
import QuizViewer from '@/components/QuizViewer';
import { useFeatureGate } from '@/components/monetization/useFeatureGate';
import GateNotice, { gateFromError } from '@/components/monetization/GateNotice';

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
 *   resolveMaterialIds () => string[]. The professor's files to read alongside
 *                      the lectures (the class's readable materials, chosen by
 *                      the student). [] means none, which is also what a caller
 *                      that never offers files gets: the request then carries
 *                      no material_ids at all and is exactly what it was
 *                      before files existed. Files with no lectures is a valid
 *                      scope — a past exam is enough to build questions from.
 *   sourceCount        how many lectures are in scope, for the button label
 *   fileCount          how many files are in scope, for the button label
 *   scopeKey           changes when the result stops belonging to what is on
 *                      screen — switching class, opening a different session.
 *                      Clears the result without remounting, which would also
 *                      throw away the tool the student had chosen.
 *   onGenerated        called with the lecture ids the material was built
 *                      from, after a successful run. PracticePanel uses it to
 *                      refresh its saved lists; a focus session uses it to
 *                      record which lectures were opened.
 */

/** "3 lectures", "2 files", "3 lectures and 2 files" — for the button while it runs. */
export function describeSources(lectureCount, fileCount) {
  const parts = [];
  if (lectureCount > 0 || fileCount === 0) parts.push(`${lectureCount} lecture${lectureCount === 1 ? '' : 's'}`);
  if (fileCount > 0) parts.push(`${fileCount} file${fileCount === 1 ? '' : 's'}`);
  return parts.join(' and ');
}

/**
 * The sentence a finished run ends on: what was made, from what, and
 * whether it stays. Flashcards and questions are rows in the class; the
 * summary sheet is not stored anywhere, so it says so, rather than letting
 * the student find out when they come back for it.
 */
export function madeLine(type, material, sources) {
  const n = type === 'flashcards' ? material?.flashcards?.length
    : type === 'practice_test' ? material?.questions?.length
      : null;
  if (type === 'summary_sheet') return `Written from ${sources}. Shown here only, so copy what you want to keep.`;
  const what = type === 'flashcards' ? 'flashcard' : 'question';
  if (typeof n !== 'number') return `Made from ${sources} and saved to this class.`;
  if (n === 0) return `No usable ${what}s came back from ${sources}.`;
  return `${n} ${what}${n === 1 ? '' : 's'} from ${sources}, saved to this class.`;
}

/**
 * Three things to build, not four.
 *
 * "Quiz" and "Practice Test" were one tool twice: the same prompt, the same
 * validator, the same rows saved to the class — the server's only instruction
 * that differed was "generate 5" against "generate 8". Two tiles, two charges,
 * one feature with a number in it.
 *
 * And "Quiz" collided with "Quiz me" on the shelf above, which is a different
 * act entirely: that one runs questions at you now, in teaching order, and
 * saves nothing. These build material that stays. The labels say which is
 * which instead of leaving a student to find out by pressing both.
 */
const materialTypes = [
  { id: 'flashcards', label: 'Flashcards', icon: Layers, description: 'Flip cards with key terms and definitions' },
  { id: 'practice_test', label: 'Practice questions', icon: ClipboardList, description: 'A set of multiple-choice questions, saved to this class' },
  { id: 'summary_sheet', label: 'Summary sheet', icon: FileText, description: 'The whole scope written up, topic by topic' },
];

export default function StudyToolbox({ classId, resolveLectureIds, resolveMaterialIds = null, sourceCount = 0, fileCount = 0, scopeKey = null, onGenerated = null }) {
  const { allowed: practiceAllowed, requiredTierName: practiceTierName, lock: practiceLock } = useFeatureGate('study_material');
  const [selectedType, setSelectedType] = useState('flashcards');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  // What the last run read, fixed at the moment it ran: the picker above may
  // have changed since, and the finished line describes the material on
  // screen, not the next run.
  const [madeFrom, setMadeFrom] = useState('');

  // Material generated for one class is not material for the next one.
  useEffect(() => { setResult(null); }, [scopeKey]);

  const generate = async () => {
    if (!classId) return;
    const ids = resolveLectureIds ? resolveLectureIds() : [];
    const materialIds = resolveMaterialIds ? resolveMaterialIds() : [];
    if (ids === null && materialIds.length === 0) { setResult({ error: 'Select at least one lecture or course file (or choose Select all).' }); return; }
    setGenerating(true);
    setResult(null);
    setMadeFrom(describeSources(sourceCount, fileCount));
    try {
      const response = await base44.functions.invoke('generateStudyMaterial', {
        class_id: classId,
        material_type: selectedType,
        lecture_ids: ids || [], // [] = whole class; otherwise the chosen subset
        // Files are named only when chosen, so a run without them is the
        // request it always was. With files and no lectures, say so: [] above
        // would read as the whole class.
        ...(materialIds.length ? { material_ids: materialIds, ...(ids === null ? { no_lectures: true } : {}) } : {}),
      });
      setResult(response.data);
      // Material a student is now looking at, built from these lectures: by
      // any honest reading, they opened them. [] means the whole class, so
      // report nothing rather than guessing which lectures that was — the
      // caller knows its own scope.
      if (onGenerated) await onGenerated(ids);
    } catch (e) {
      // A refusal is kept whole so it can be rendered as something to press.
      // It used to be flattened to its message, which left the student reading
      // "this needs Scholar" with no way to get Scholar.
      const gate = gateFromError(e);
      if (gate) { setResult({ gate }); setGenerating(false); return; }
      // Show what the server said when it said something. The generic line
      // below hid a NOT NULL violation for two weeks: the student read
      // "try again", tried again, and got the same thing.
      const said = e?.response?.data?.message || e?.response?.data?.error;
      setResult({ error: said || 'Failed to generate study material. Please try again.' });
    }
    setGenerating(false);
  };

  const chosen = materialTypes.find(t => t.id === selectedType) || materialTypes[0];
  const chosenLabel = chosen.label.toLowerCase();
  const sources = describeSources(sourceCount, fileCount);
  const hasSources = sourceCount > 0 || fileCount > 0;

  return (
    <div>
      {/* One choice and one button, in one box: a radio group, not three
          cards competing with the three tiles above. Three columns from the
          width that fits them; one column on a phone, where three stacked
          rows read as a list, which is what they are. */}
      <div className="rounded-xl border border-border bg-card mb-6 overflow-hidden">
        <div role="radiogroup" aria-label="What to make" className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
          {materialTypes.map(t => {
            const Icon = t.icon;
            const on = selectedType === t.id;
            return (
              <button key={t.id} type="button" onClick={() => setSelectedType(t.id)}
                role="radio" aria-checked={on}
                className={`flex items-start gap-3 text-left p-3.5 sm:p-4 transition-colors duration-micro focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${on ? 'bg-primary/[0.06] dark:bg-primary/10' : 'hover:bg-muted/60 active:bg-muted'}`}>
                <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${on ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  <Icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-foreground">{t.label}</span>
                    {on && <Check className="w-3.5 h-3.5 text-primary" strokeWidth={2.5} aria-hidden="true" />}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5">{t.description}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="p-3.5 sm:p-4 border-t border-border">
          {/* Make button — grey lock below Student (server re-enforces) */}
          {!practiceAllowed ? (
            <button type="button" onClick={practiceLock}
              className="w-full py-3 rounded-xl bg-muted text-muted-foreground text-sm font-medium hover:text-foreground transition-colors flex items-center justify-center gap-2">
              <Lock className="w-4 h-4" /> Practice questions ship with {practiceTierName}. Upgrade to use them
            </button>
          ) : (
            <>
              <button type="button" onClick={generate} disabled={generating || !classId}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.99] disabled:opacity-50 transition-all duration-micro flex items-center justify-center gap-2">
                {generating
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Reading {madeFrom || sources}…</>
                  : <><Sparkles className="w-4 h-4" /> Make {chosenLabel}</>}
              </button>
              {/* The button says what; this line says from what, so the
                  selection made at the top of the page is confirmed at the
                  moment it is used. While it runs, the line names the work
                  being done, which is the real work: read, then write. */}
              <p className="text-[11px] text-muted-foreground text-center mt-2 tabular-nums">
                {generating ? `Then writing your ${chosenLabel}` : hasSources ? `From ${sources}` : 'Select at least one lecture above'}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Generated result */}
      {result && !result.error && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="font-heading text-sm font-semibold text-muted-foreground">Just made</h2>
          </div>
          {/* The run ends on a sentence of facts: how many, and whether they
              stay. The summary sheet is the honest exception: it is shown
              here and nowhere else, and the student should hear that before
              they navigate away from it. */}
          <p className="text-xs text-muted-foreground mb-3">{madeLine(result.material_type || selectedType, result.material, madeFrom)}</p>
          {/* The server names the files it actually read: one chosen without
              readable text is left out, and the student should see that. */}
          {Array.isArray(result.materials_used) && result.materials_used.length > 0 && (
            <p className="text-xs text-muted-foreground mb-3">Built with {result.materials_used.map((m) => m.file_name).join(', ')}</p>
          )}
          {selectedType === 'flashcards' && result.material?.flashcards && (
            <FlashcardViewer flashcards={result.material.flashcards} />
          )}
          {selectedType === 'practice_test' && result.material?.questions && (
            <QuizViewer questions={result.material.questions} />
          )}
          {selectedType === 'summary_sheet' && result.material?.summary && (
            <div className="rounded-xl border border-border bg-card p-5">
              <pre className="text-sm text-foreground whitespace-pre-wrap font-body">{result.material.summary}</pre>
            </div>
          )}
        </div>
      )}
      {result?.gate && <GateNotice gate={result.gate} source="study-material" className="mb-6" />}
      {result?.error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 mb-6">
          <p className="text-sm text-destructive">{result.error}</p>
        </div>
      )}
    </div>
  );
}
