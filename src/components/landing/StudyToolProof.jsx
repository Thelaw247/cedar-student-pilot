import React, { useState } from 'react';
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

  return (
    <section id="see-the-app" className="px-4 py-20 sm:px-6 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-blue-600">Real Cedar study tools</p>
          <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">See what you actually use before an exam.</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">These previews use the same components as the signed-in app. Click through them here with sample course data.</p>
        </div>

        <div className="mt-10 overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_24px_70px_-38px_rgba(15,23,42,0.3)]">
          <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-slate-50 p-2">
            {[
              ['scope', 'Choose lectures'],
              ['flashcards', 'Flashcards'],
              ['practice', 'Practice questions'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${tab === id ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="bg-background p-4 sm:p-7">
            {tab === 'scope' && (
              <div className="mx-auto max-w-xl">
                <div className="mb-5">
                  <p className="text-xs font-medium text-muted-foreground">PHYS 117 · Midterm</p>
                  <h3 className="mt-1 font-heading text-xl font-bold text-foreground">Choose what the test covers</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Pick the lectures once. Cedar uses the same selection for the study material you create next.</p>
                </div>
                <LectureScopePicker lectures={lectures} selectedIds={selectedIds} onChange={setSelectedIds} />
              </div>
            )}
            {tab === 'flashcards' && (
              <div className="mx-auto max-w-xl">
                <FlashcardViewer flashcards={flashcards} />
              </div>
            )}
            {tab === 'practice' && (
              <div className="mx-auto max-w-xl">
                <QuizViewer questions={questions} />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
