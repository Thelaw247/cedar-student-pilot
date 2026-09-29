import React from 'react';
import { Mic, ShieldCheck, Eye, LogOut, BookOpenCheck } from 'lucide-react';

/**
 * The four commitments: the category's one-star reviews inverted, every
 * line a policy Praelecta actually enforces in code. On the pricing page,
 * under the plans — the fear of a trap is what stops a student paying, so
 * the promises sit beside the prices rather than on the homepage.
 */
const COMMITMENTS = [
  { icon: Mic, title: 'A recording never cuts out mid-lecture', body: 'Long classes keep recording for up to six hours, quietly, in the background. Your audio is never held hostage to a limit.' },
  { icon: Eye, title: 'You see every limit before you hit it', body: 'Your balance is always on screen and every action shows its cost up front. No surprise wall halfway through a lecture.' },
  { icon: LogOut, title: 'Cancel in one tap', body: 'Leaving is one tap in Settings. No chat with support, no “are you sure” maze. Everything you already made stays yours.' },
  { icon: BookOpenCheck, title: 'Your lectures, never your assignments', body: 'We help you learn what your professor actually said. We do not write your essays, and recording always starts with permission.' },
];

export default function LandingWhyStudents() {
  return (
    <div id="promises" className="rounded-[26px] border border-border bg-muted p-7 sm:p-9">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 className="text-xl font-bold tracking-[-0.03em] text-foreground">Four things we will never do to you</h2>
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        Study apps have earned a reputation: hidden quotas, paywalls dressed up as errors, cancel screens built to lose you.
        These four are not marketing lines. They are written into the code.
      </p>
      <div className="mt-6 grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {COMMITMENTS.map((c) => (
          <div key={c.title} className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
              <c.icon className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{c.title}</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{c.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
