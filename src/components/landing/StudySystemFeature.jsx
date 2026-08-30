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
  { icon: Layers3, title: 'Flashcards', body: 'Generate cards from the exact lectures you choose.' },
  { icon: FileQuestion, title: 'Quizzes', body: 'Test recall instead of only rereading the material.' },
  { icon: ClipboardList, title: 'Practice tests', body: 'Use mixed questions across the course material you selected.' },
  { icon: FileText, title: 'Summary sheets', body: 'Turn lecture material into a comprehensive topic-by-topic study sheet.' },
  { icon: RefreshCcw, title: 'Lecture reviews', body: 'Review today, this week, or any specific group of lectures in teaching order.' },
  { icon: BookOpen, title: 'Class handbook', body: 'Study from the living handbook built from the lectures already in the class.' },
  { icon: Clock3, title: 'Focus sessions', body: 'Use Pomodoro-style intervals or a simple timer with tracked study time.' },
  { icon: Brain, title: 'In-app or on paper', body: 'Study interactively in Praelecta or generate a structured guide to work through offline.' },
  { icon: Target, title: 'Session review', body: 'Finish with questions and self-assessment to find what still needs work.' },
  { icon: BarChart3, title: 'Knowledge coverage', body: 'Track proficiency, course coverage, concepts seen, and concepts mastered over time.' },
  { icon: CalendarCheck2, title: 'Spaced lecture reviews', body: 'After a recorded lecture, schedule future review touchpoints instead of trusting memory.' },
  { icon: RefreshCcw, title: 'Rebook when life changes', body: 'Move a scheduled study session when the original time no longer works.' },
  { icon: BookOpen, title: 'Missed-lecture recovery', body: 'Create a clearly labelled estimate from previous lectures and any course guidance you provide when you miss class.' },
  { icon: Music2, title: 'Focus environment', body: 'Keep the timer, study material, and optional study music together during the session.' },
];

const wizardSteps = [
  {
    number: '1',
    title: 'Choose the job.',
    body: 'Review recent lectures, prep for a specific exam or quiz, or work through the class in depth.',
  },
  {
    number: '2',
    title: 'Choose the material.',
    body: 'For a review, pick the lectures. For exam prep, pick the test. We carry that scope into the session.',
  },
  {
    number: '3',
    title: 'Choose how you want to work.',
    body: 'Study inside Praelecta with interactive material or use a generated guide on paper.',
  },
  {
    number: '4',
    title: 'We set the rhythm.',
    body: 'The session type determines the study goal, interval length, break length, material, and what gets reviewed afterward.',
  },
];

const projectSteps = [
  'Describe the project and due date.',
  'We ask only for the missing details we need.',
  'The project becomes a 3–6 step roadmap of concrete work sessions.',
  'Each step gets a realistic time estimate and a clear action to complete.',
  'Those work sessions are spread from now to the due date on your planner.',
  'Need more time later? We search open calendar gaps before the deadline and book the extra work there.',
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
                <p className="mt-0.5 text-sm font-semibold text-muted-foreground">The calendar tells you when. We also tell you what to do when you get there.</p>
              </div>
            </div>

            <h2 className="mt-5 text-4xl font-bold leading-[1.04] tracking-[-0.05em] text-foreground sm:text-5xl">
              Studying stops being one giant task.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
              “Study for the midterm” is vague enough to procrastinate on. We turn it into a sequence: choose the goal, narrow the material, choose the method, work in a defined session, retrieve what you know, then review what you missed.
            </p>

            <div className="mt-7 rounded-2xl border border-primary/25 bg-primary/10 p-5">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Built from well-supported learning principles</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                We combine spaced practice with repeated retrieval through quizzes, practice questions, and post-session review. Research consistently finds that distributing learning over time and actively retrieving information can improve later retention compared with massed study or additional rereading alone.
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
                    <h3 className="mt-1 text-xl font-bold tracking-[-0.03em] text-foreground">We turn a study goal into a specific session.</h3>
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
                <h3 className="mt-2 text-2xl font-bold tracking-[-0.035em] text-foreground">Use the tool the material needs — without rebuilding the course.</h3>
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
                  <h3 className="mt-2 text-3xl font-bold leading-tight tracking-[-0.04em]">Turn “finish the project” into work you can actually start.</h3>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    We first figure out what information is missing, then build a roadmap of concrete tasks that each fit into a single work session. The sessions are distributed from now to the due date so the project has a path to completion instead of one giant deadline.
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
                  <p><span className="font-semibold text-foreground">If a project takes longer than expected, we can recover.</span> After a project work session, you can ask for more time; we check open gaps before the due date and schedule additional project sessions there. If there is not enough free time, we show lower-priority calendar items that could be moved or removed.</p>
                </div>
              </div>
          </div>
        </div>
      </div>
    </section>
  );
}