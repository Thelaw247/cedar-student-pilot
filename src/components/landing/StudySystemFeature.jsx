import React from 'react';
import {
  BarChart3,
  BookOpen,
  Brain,
  CalendarCheck2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileQuestion,
  FileText,
  Layers3,
  Music2,
  RefreshCcw,
  Route,
  Sparkles,
  Target,
} from 'lucide-react';

const studyTools = [
  { icon: Layers3, title: 'Flashcards', body: 'Made from the exact lectures you pick, not the whole textbook.' },
  { icon: FileQuestion, title: 'Quizzes', body: 'Test yourself instead of rereading and hoping it stuck.' },
  { icon: ClipboardList, title: 'Practice tests', body: 'Mixed questions across everything you selected, like the real thing.' },
  { icon: FileText, title: 'Summary sheets', body: 'A whole topic on one sheet, in the order it was taught.' },
  { icon: RefreshCcw, title: 'Lecture reviews', body: 'Review today, this week, or any set of lectures, in teaching order.' },
  { icon: BookOpen, title: 'Class handbook', body: 'A textbook for your class, written from your own lectures.' },
  { icon: Clock3, title: 'Focus sessions', body: 'A timer that tracks the study time you actually put in.' },
  { icon: Brain, title: 'In-app or on paper', body: 'Study on screen, or print a guide and work through it offline.' },
  { icon: Target, title: 'Session review', body: 'End with a few questions so you know what still needs work.' },
  { icon: BarChart3, title: 'Knowledge coverage', body: 'See which concepts you have seen, which you own, and what is still shaky.' },
  { icon: CalendarCheck2, title: 'Spaced lecture reviews', body: 'Reviews get booked after each lecture, so you are not trusting your memory to hold on its own.' },
  { icon: RefreshCcw, title: 'Rebook when life changes', body: 'A session stops working? Move it and we find the next open gap.' },
  { icon: BookOpen, title: 'Missed-lecture recovery', body: 'Missed class? Get a clearly labelled estimate of what was covered, built from the lectures around it.' },
  { icon: Music2, title: 'Focus environment', body: 'Timer, material and study music in one place, so you stop tab-hopping.' },
];

const wizardSteps = [
  {
    number: '1',
    title: 'Pick the job.',
    body: 'Review this week, prep for a specific exam or quiz, or go deep on the whole class.',
  },
  {
    number: '2',
    title: 'Pick the material.',
    body: 'For a review, tick the lectures. For a test, pick the exam. We keep everything inside that scope.',
  },
  {
    number: '3',
    title: 'Pick how you work.',
    body: 'In the app with live flashcards and quizzes, or a printed guide to work through on paper.',
  },
  {
    number: '4',
    title: 'We set the rhythm.',
    body: 'Work intervals, breaks, the material and what gets reviewed at the end are all set by the session type. You just start.',
  },
];

const projectSteps = [
  'Tell us the project and when it is due.',
  'We ask only for the details we are actually missing.',
  'It becomes a 3 to 6 step roadmap, each step small enough for one sitting.',
  'Every step gets a realistic time estimate and one clear thing to do.',
  'Those sittings get spread between now and the due date on your planner.',
  'Running behind? We look for open gaps before the deadline and book the extra time there.',
];

export default function StudySystemFeature() {
  return (
    <section id="study-system" className="px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <div className="flex items-center gap-3">
              <span className="text-5xl font-black tracking-[-0.07em] text-primary/25">04</span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">The complete study system</p>
                <p className="mt-0.5 text-sm font-semibold text-muted-foreground">The calendar says when. This tells you what to actually do.</p>
              </div>
            </div>

            <h2 className="mt-5 text-4xl font-bold leading-[1.04] tracking-[-0.05em] text-foreground sm:text-5xl">
              Never sit down to study and wonder where to start.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
              &ldquo;Study for the midterm&rdquo; is vague enough to put off for a week. So we break it into a session with a job: you pick the goal, we narrow the material, you pick how you want to work, and the flashcards, quiz, timer and end-of-session review are already waiting when you open it.
            </p>

            <div className="mt-7 rounded-2xl border border-primary/25 bg-primary/10 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Built on what actually works</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Spacing your study out and testing yourself both beat rereading for remembering things later. It is one of the most repeated findings in learning research, and every session here is built around both.
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold">
                <a href="https://pubmed.ncbi.nlm.nih.gov/16719566/" target="_blank" rel="noreferrer" className="text-primary hover:text-primary">Spacing research</a>
                <a href="https://pubmed.ncbi.nlm.nih.gov/16507066/" target="_blank" rel="noreferrer" className="text-primary hover:text-primary">Retrieval-practice research</a>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="overflow-hidden rounded-[28px] border border-border bg-card shadow-[0_24px_70px_-38px_rgba(0,0,0,0.55)]">
              <div className="border-b border-border bg-muted p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Route className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-primary">Guided session setup</p>
                    <h3 className="mt-1 text-xl font-bold tracking-[-0.03em] text-foreground">Four taps from &ldquo;I should study&rdquo; to actually studying.</h3>
                  </div>
                </div>
              </div>

              <div className="grid gap-px bg-border sm:grid-cols-2">
                {wizardSteps.map((step) => (
                  <div key={step.number} className="bg-card p-5 sm:p-6">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{step.number}</span>
                    <h4 className="mt-4 text-base font-bold text-foreground">{step.title}</h4>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-border bg-muted p-5 sm:p-6">
                <p className="text-xs font-semibold text-foreground/80">Current Praelecta presets</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border bg-card p-4"><p className="text-[10px] font-bold uppercase tracking-[0.11em] text-primary">Lecture review</p><p className="mt-2 text-sm font-bold text-foreground">30 min goal</p><p className="mt-1 text-xs leading-5 text-muted-foreground">20-minute work intervals with 5-minute breaks; timing stays adjustable.</p></div>
                  <div className="rounded-xl border border-border bg-card p-4"><p className="text-[10px] font-bold uppercase tracking-[0.11em] text-rose-400">Exam prep</p><p className="mt-2 text-sm font-bold text-foreground">45 min goal</p><p className="mt-1 text-xs leading-5 text-muted-foreground">15-minute focused intervals with 3-minute breaks; timing stays adjustable.</p></div>
                  <div className="rounded-xl border border-border bg-card p-4"><p className="text-[10px] font-bold uppercase tracking-[0.11em] text-amber-400">Deep study</p><p className="mt-2 text-sm font-bold text-foreground">90 min goal</p><p className="mt-1 text-xs leading-5 text-muted-foreground">25-minute work intervals with 5-minute breaks; timing stays adjustable.</p></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2 lg:items-stretch">
          <div className="h-full rounded-[28px] border border-border bg-card p-5 sm:p-7">
            <div className="max-w-2xl">
                <p className="text-xs font-bold uppercase tracking-[0.13em] text-primary">Every study tool in the same class</p>
                <h3 className="mt-2 text-2xl font-bold tracking-[-0.035em] text-foreground">Every tool works from the same class. Nothing to rebuild, ever.</h3>
              </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {studyTools.map((tool) => (
                  <div key={tool.title} className="rounded-2xl border border-border bg-muted/70 p-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary"><tool.icon className="h-4 w-4" /></div>
                    <h4 className="mt-3 text-sm font-bold text-foreground">{tool.title}</h4>
                    <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{tool.body}</p>
                  </div>
                ))}
              </div>
            </div>

          <div className="h-full overflow-hidden rounded-[28px] border border-border bg-secondary text-secondary-foreground">
            <div className="p-6 sm:p-8">
                <div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-card/10 text-primary"><Sparkles className="h-5 w-5" /></div>
                  <p className="mt-5 text-xs font-bold uppercase tracking-[0.13em] text-primary">Projects work the same way</p>
                  <h3 className="mt-2 text-3xl font-bold leading-tight tracking-[-0.04em]">Turn &ldquo;finish the project&rdquo; into work you can actually start tonight.</h3>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    We ask only for the details we are missing, split the project into steps that each fit one sitting, and spread those sittings between now and the due date. A path, instead of one giant deadline you keep not starting.
                  </p>
                </div>

              <div className="mt-7 space-y-2.5">
                {projectSteps.map((step, index) => (
                  <div key={step} className="flex gap-3 rounded-xl border border-border bg-card/[0.06] p-3.5">
                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">{index + 1}</span>
                    <p className="text-xs leading-5 text-muted-foreground">{step}</p>
                  </div>
                ))}
              </div>

              <div className="mt-7 rounded-2xl border border-border bg-card p-4 text-foreground shadow-[0_18px_45px_-28px_rgba(0,0,0,0.55)] sm:p-5">
                <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-primary">Production flow preview</p>
                    <p className="mt-1 text-sm font-bold">Your Roadmap</p>
                  </div>
                  <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary">Project · PHYS 117</span>
                </div>

                <div className="mt-4 rounded-xl border border-border bg-muted p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">1</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs font-bold text-foreground">Research &amp; define requirements</p>
                        <span className="inline-flex flex-none items-center gap-1 text-[9px] font-semibold text-muted-foreground"><Clock3 className="h-3 w-3" /> 60 min</span>
                      </div>
                      <p className="mt-1 text-[10px] leading-4 text-muted-foreground">Collect the required sources, constraints, and project criteria before building.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 rounded-xl border border-border bg-muted p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">2</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs font-bold text-foreground">Build the first working version</p>
                        <span className="inline-flex flex-none items-center gap-1 text-[9px] font-semibold text-muted-foreground"><Clock3 className="h-3 w-3" /> 90 min</span>
                      </div>
                      <p className="mt-1 text-[10px] leading-4 text-muted-foreground">Complete the core deliverable before polishing details or formatting.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 rounded-xl border border-border bg-muted p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">3</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs font-bold text-foreground">Test, revise &amp; fill gaps</p>
                        <span className="inline-flex flex-none items-center gap-1 text-[9px] font-semibold text-muted-foreground"><Clock3 className="h-3 w-3" /> 60 min</span>
                      </div>
                      <p className="mt-1 text-[10px] leading-4 text-muted-foreground">Check the work against the requirements, fix weak sections, and resolve anything still incomplete.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 rounded-xl border border-border bg-muted p-3.5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">4</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs font-bold text-foreground">Polish &amp; submit</p>
                        <span className="inline-flex flex-none items-center gap-1 text-[9px] font-semibold text-muted-foreground"><Clock3 className="h-3 w-3" /> 45 min</span>
                      </div>
                      <p className="mt-1 text-[10px] leading-4 text-muted-foreground">Finish formatting, citations, final checks, and prepare the project for submission.</p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-5 gap-1.5">
                  <div className="rounded-lg border border-border bg-secondary px-1.5 py-2 text-center"><p className="text-[8px] font-semibold text-muted-foreground/80">MON</p><div className="mt-1 rounded-md bg-primary/10 px-1 py-1 text-[8px] font-semibold text-primary">Step 1</div></div>
                  <div className="rounded-lg border border-border bg-secondary px-1.5 py-2 text-center"><p className="text-[8px] font-semibold text-muted-foreground/80">TUE</p><div className="mt-1 rounded-md bg-primary/10 px-1 py-1 text-[8px] font-semibold text-primary">Step 2</div></div>
                  <div className="rounded-lg border border-border bg-secondary px-1.5 py-2 text-center"><p className="text-[8px] font-semibold text-muted-foreground/80">WED</p><div className="mt-1 rounded-md bg-primary/10 px-1 py-1 text-[8px] font-semibold text-primary">Step 3</div></div>
                  <div className="rounded-lg border border-border bg-secondary px-1.5 py-2 text-center"><p className="text-[8px] font-semibold text-muted-foreground/80">THU</p><div className="mt-1 rounded-md bg-primary/10 px-1 py-1 text-[8px] font-semibold text-primary">Step 4</div></div>
                  <div className="rounded-lg border border-border bg-secondary px-1.5 py-2 text-center"><p className="text-[8px] font-semibold text-muted-foreground/80">FRI</p><div className="mt-1 rounded-md bg-emerald-500/10 px-1 py-1 text-[8px] font-semibold text-emerald-400">Due</div></div>
                </div>

                <p className="mt-3 text-center text-[9px] leading-4 text-muted-foreground/80">Based directly on Praelecta&rsquo;s current project setup and roadmap flow.</p>
              </div>
            </div>

            <div className="border-t border-border bg-card/[0.04] px-6 py-4 sm:px-8">
                <div className="flex items-start gap-3 text-xs leading-5 text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-400" />
                  <p><span className="font-semibold text-foreground">Running late on a project? That is fine.</span> Ask for more time after any session and we look for open gaps before the due date and book the extra work there. If the calendar is genuinely full, we show you the lower-priority things that could move.</p>
                </div>
              </div>
          </div>
        </div>
      </div>
    </section>
  );
}