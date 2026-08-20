import React from 'react';
import { BookOpen, CalendarDays, FileText, Mic, Target } from 'lucide-react';

const steps = [
  {
    number: '1',
    icon: CalendarDays,
    title: 'Add your classes.',
    body: 'Set up your semester once so Cedar knows where each lecture, exam, assignment, and study session belongs.',
  },
  {
    number: '2',
    icon: Mic,
    title: 'Record the lecture.',
    body: 'When you have permission to record, start Cedar in class and let it keep the lecture attached to the right course.',
  },
  {
    number: '3',
    icon: FileText,
    title: 'Open it later.',
    body: 'The lecture stays with its transcript, summary, concepts, formulas, notes, and exam mentions instead of disappearing into a recording folder.',
  },
  {
    number: '4',
    icon: Target,
    title: 'Tell Cedar what the test covers.',
    body: 'Choose the lectures you are responsible for. You do not need to copy notes into another app or start from a blank AI prompt.',
  },
  {
    number: '5',
    icon: BookOpen,
    title: 'Study from that material.',
    body: 'Use flashcards, practice questions, reviews, focused study, and the class handbook from the same course material.',
  },
];

export default function SimpleWorkflow() {
  return (
    <section id="how-it-works" className="border-y border-slate-200 bg-slate-50 px-4 py-20 sm:px-6 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold text-blue-600">How Cedar works</p>
          <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">The whole idea in five steps.</h2>
          <p className="mt-4 text-base leading-7 text-slate-600">No new workflow to learn. Cedar follows the one you already have from the first class to the exam.</p>
        </div>

        <div className="mt-10 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
          {steps.map((step) => (
            <div key={step.number} className="grid gap-4 p-5 sm:grid-cols-[52px_1fr] sm:items-start sm:p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <step.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-600">{step.number}</span>
                  <h3 className="text-lg font-bold tracking-[-0.02em] text-slate-950">{step.title}</h3>
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
