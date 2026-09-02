import React from 'react';
import { Mic, PenLine, Layers, ShieldCheck, Eye, LogOut, BookOpenCheck } from 'lucide-react';

/**
 * Two research-backed bands (ICP-01 §2, CMP-02 §5).
 *
 * "Sound familiar?" speaks the three persona pains in the students' own
 * trigger vocabulary; the trust band states the commitments that are the
 * category's one-star reviews inverted — no competitor named, every line a
 * policy Praelecta actually enforces in code.
 */
const PAINS = [
  {
    icon: Mic,
    quote: '“My prof talks too fast.”',
    answer: 'Record it and replay any part, with the transcript right beside it. A fast lecturer stops being your problem.',
  },
  {
    icon: PenLine,
    quote: '“I can’t listen and take notes at the same time.”',
    answer: 'Then don’t. Just listen. The transcript, summary and key concepts are done a few minutes after class ends.',
  },
  {
    icon: Layers,
    quote: '“It’s week 10 and I’m fourteen lectures behind.”',
    answer: 'Every recorded lecture is already flashcards, practice questions and exam-topic predictions. Catching up means studying, not rebuilding fourteen weeks of notes.',
  },
];

const COMMITMENTS = [
  { icon: Mic, title: 'A recording never cuts out mid-lecture', body: 'Long classes keep recording for up to six hours, quietly, in the background. Your audio is never held hostage to a limit.' },
  { icon: Eye, title: 'You see every limit before you hit it', body: 'Your balance is always on screen and every action shows its cost up front. No surprise wall halfway through a lecture.' },
  { icon: LogOut, title: 'Cancel in one tap', body: 'Leaving is one tap in Settings. No chat with support, no “are you sure” maze. Everything you already made stays yours.' },
  { icon: BookOpenCheck, title: 'Your lectures, never your assignments', body: 'We help you learn what your professor actually said. We do not write your essays, and recording always starts with permission.' },
];

export default function LandingWhyStudents() {
  return (
    <section id="why-students" className="px-4 py-20 sm:px-6 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold text-primary">Sound familiar?</p>
          <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">
            Three things every student says. We fixed all three.
          </h2>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {PAINS.map((p) => (
            <div key={p.quote} className="rounded-[26px] border border-border bg-card p-6 shadow-[0_18px_55px_-35px_rgba(0,0,0,0.60)] sm:p-7">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <p.icon className="h-5 w-5" />
              </div>
              <p className="mt-5 text-lg font-bold tracking-[-0.02em] text-foreground">{p.quote}</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{p.answer}</p>
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-[26px] border border-border bg-muted p-7 sm:p-9">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h3 className="text-xl font-bold tracking-[-0.03em] text-foreground">Four things we will never do to you</h3>
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Study apps have earned a reputation: hidden quotas, paywalls dressed up as errors, cancel screens built to lose you.
            These four are not marketing lines. They are written into the code.
          </p>
          <div className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {COMMITMENTS.map((c) => (
              <div key={c.title} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                  <c.icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{c.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
