import React from 'react';
import { Mic, PenLine, Layers, ShieldCheck, Eye, LogOut, BookOpenCheck } from 'lucide-react';

/**
 * Two research-backed bands (ICP-01 §2, CMP-02 §5).
 *
 * "Sound familiar?" speaks the three persona pains in the students' own
 * trigger vocabulary; the trust band states the commitments that are the
 * category's one-star reviews inverted — no competitor named, every line a
 * policy Cedar actually enforces in code.
 */
const PAINS = [
  {
    icon: Mic,
    quote: '“My prof talks too fast.”',
    answer: 'Record the lecture and replay anything, with the full transcript beside it. Nothing gets past you at native speed again.',
  },
  {
    icon: PenLine,
    quote: '“I can’t listen and take notes at the same time.”',
    answer: 'Just listen. Cedar takes the notes — transcript, summary and key concepts, minutes after class ends.',
  },
  {
    icon: Layers,
    quote: '“It’s week 10 and I’m fourteen lectures behind.”',
    answer: 'Every recorded lecture is already flashcards, practice questions and exam-topic predictions. Catching up is studying, not rebuilding.',
  },
];

const COMMITMENTS = [
  { icon: Mic, title: 'A recording never stops mid-lecture', body: 'Long classes rotate segments silently for up to six hours. Your audio is never held hostage to a limit.' },
  { icon: Eye, title: 'Every limit is visible before you hit it', body: 'Your credit balance is always on screen, and every action shows its cost up front. No surprise walls.' },
  { icon: LogOut, title: 'Cancel in one tap', body: 'Leaving takes one tap in Settings — no chat with support, no retention maze. What you already made stays yours.' },
  { icon: BookOpenCheck, title: 'Your lectures, never your assignments', body: 'Cedar helps you learn what your professor actually said. It doesn’t write essays, and recording starts with permission.' },
];

export default function LandingWhyStudents() {
  return (
    <section id="why-students" className="border-t border-slate-200 bg-white px-4 py-20 sm:px-6 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold text-blue-600">Sound familiar?</p>
          <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">
            Cedar was built for the three sentences every student says
          </h2>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {PAINS.map((p) => (
            <div key={p.quote} className="rounded-[26px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_-35px_rgba(15,23,42,0.35)] sm:p-7">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <p.icon className="h-5 w-5" />
              </div>
              <p className="mt-5 text-lg font-bold tracking-[-0.02em] text-slate-950">{p.quote}</p>
              <p className="mt-3 text-sm leading-6 text-slate-600">{p.answer}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-[26px] border border-slate-200 bg-slate-50 p-7 sm:p-9">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-blue-600" />
            <h3 className="text-xl font-bold tracking-[-0.03em] text-slate-950">Four things Cedar will never do to you</h3>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Study apps have a reputation problem — hidden quotas, paywalls dressed as errors, cancel mazes.
            These four commitments are enforced in Cedar&rsquo;s code, not just its copy.
          </p>
          <div className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {COMMITMENTS.map((c) => (
              <div key={c.title} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm">
                  <c.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-950">{c.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
