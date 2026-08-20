import React, { useState } from 'react';
import { ArrowRight, Brain, CheckCircle2, Target } from 'lucide-react';
import LectureScopePicker from '@/components/LectureScopePicker';
import FlashcardViewer from '@/components/FlashcardViewer';
import QuizViewer from '@/components/QuizViewer';

const lectures = [
  { id: 'l6', ai_title: 'Force vectors and components', date: '2026-09-14' },
  { id: 'l7', ai_title: 'Free-body diagrams', date: '2026-09-16' },
  { id: 'l8', ai_title: 'Equilibrium conditions', date: '2026-09-18' },
  { id: 'l9', ai_title: 'Moments and couples', date: '2026-09-21' },
  { id: 'l10', ai_title: 'Distributed loads', date: '2026-09-23' },
  { id: 'l11', ai_title: 'Truss analysis', date: '2026-09-25' },
];

const flashcards = [
  { front: 'What conditions must be satisfied for a rigid body to be in equilibrium?', back: 'The net force and the net moment acting on the body must both equal zero.' },
  { front: 'What is the purpose of a free-body diagram?', back: 'To isolate a body and show every external force and moment acting on it.' },
  { front: 'What is a moment?', back: 'The turning effect of a force about a point or axis, equal to force multiplied by perpendicular distance.' },
];

const questions = [
  {
    type: 'multiple_choice',
    question: 'A body is in static equilibrium when:',
    options: ['Only the vertical forces cancel', 'The net force and net moment are zero', 'The acceleration is constant', 'All forces have the same magnitude'],
    answer: 'The net force and net moment are zero',
  },
  {
    type: 'multiple_choice',
    question: 'Which diagram should you draw before writing equilibrium equations?',
    options: ['Velocity diagram', 'Free-body diagram', 'Stress-strain curve', 'Circuit diagram'],
    answer: 'Free-body diagram',
  },
];

export default function StudyToolProof() {
  const [selectedIds, setSelectedIds] = useState(['l6', 'l7', 'l8', 'l9', 'l10', 'l11']);
  const [tab, setTab] = useState('scope');
  const selectedCount = selectedIds.length === 0 ? lectures.length : selectedIds.filter((id) => id !== '__none__').length;

  return (
    <section id="test-coverage" className="px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <div className="flex items-center gap-3">
              <span className="text-5xl font-black tracking-[-0.07em] text-blue-100">02</span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-600">Exact test coverage</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-500">The test is not always the whole course.</p>
              </div>
            </div>
            <h2 className="mt-5 text-4xl font-bold leading-[1.04] tracking-[-0.05em] text-slate-950 sm:text-5xl">
              Tell Cedar exactly what the test covers.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">
              Pick the lectures once. Cedar uses that exact slice of the course for the study material you create next instead of making you paste notes into a new tool and explain the class again.
            </p>

            <div className="mt-7 rounded-2xl border border-blue-100 bg-blue-50/70 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">What happens next</p>
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-blue-600" /><span>Flashcards use the lectures you selected.</span></div>
                <div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-blue-600" /><span>Practice questions and reviews stay inside the same scope.</span></div>
                <div className="flex gap-3"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-blue-600" /><span>The class handbook can open to the same portion of the course.</span></div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_70px_-38px_rgba(15,23,42,0.3)]">
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">Actual Cedar component · sample data</p>
                <p className="mt-1 text-sm font-semibold text-slate-950">PHYS 117 Midterm</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-blue-700 shadow-sm">
                <Target className="h-4 w-4" /> {selectedCount} lectures selected
              </div>
            </div>

            <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-white p-2">
              {[
                ['scope', '1. Choose lectures'],
                ['flashcards', '2. Flashcards'],
                ['practice', '3. Practice questions'],
              ].map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${tab === id ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="bg-background p-4 sm:p-7">
              {tab === 'scope' && (
                <div className="mx-auto max-w-xl">
                  <h3 className="font-heading text-xl font-bold text-foreground">What is on this midterm?</h3>
                  <p className="mb-5 mt-1 text-sm text-muted-foreground">Select the lectures your professor says are included.</p>
                  <LectureScopePicker lectures={lectures} selectedIds={selectedIds} onChange={setSelectedIds} />
                  <button type="button" onClick={() => setTab('flashcards')} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90">
                    Use these lectures <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
              {tab === 'flashcards' && (
                <div className="mx-auto max-w-xl">
                  <div className="mb-4 flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /><p className="text-sm font-semibold text-foreground">Flashcards from the selected coverage</p></div>
                  <FlashcardViewer flashcards={flashcards} />
                </div>
              )}
              {tab === 'practice' && (
                <div className="mx-auto max-w-xl">
                  <div className="mb-4 flex items-center gap-2"><Brain className="h-4 w-4 text-primary" /><p className="text-sm font-semibold text-foreground">Practice from the selected coverage</p></div>
                  <QuizViewer questions={questions} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}