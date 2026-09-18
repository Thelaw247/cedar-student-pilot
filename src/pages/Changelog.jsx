import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import MarketingShell from '@/components/landing/MarketingShell';
import { DESKTOP_RELEASES_URL } from '@/lib/desktopDownloads';

/**
 * /changelog — what shipped, with dates.
 *
 * Written from the commit history, in the words a student would use, newest
 * first. Two jobs: a visitor can see the product is alive and moving, and a
 * crawler gets dated content beyond the two legal pages. Add an entry when
 * something a student can notice ships; leave out refactors and CI.
 */
export const CHANGELOG = [
  {
    date: '2026-09-18',
    title: 'Practice material from the professor’s own files',
    items: [
      'Flashcards, practice questions and summary sheets can now be built from a syllabus, a formula sheet or a past exam, alongside your lectures or on their own. Same one credit.',
      'A class has its own Course materials: attach a file to the course, not only to one lecture.',
      'Upload a corrected timetable into the semester you already have; matched courses update and your lectures stay where they are. Settings has a Semesters section to manage or delete a semester.',
      'Desktop app 1.0.3: when a recording cannot start, the app says why in the browser’s words and, on Windows, opens the microphone privacy setting for you.',
    ],
  },
  {
    date: '2026-09-16',
    title: 'Attendance and the week view',
    items: [
      'Attendance check-ins only ask about lectures that happened after you added the class, so a fresh timetable import no longer opens with fourteen questions.',
      'The weekly calendar always shows Monday to Friday, with the weekend only when something is on it.',
    ],
  },
  {
    date: '2026-09-09',
    title: 'Professor PDFs, and the sign-up code',
    items: [
      'Reading a professor’s PDF is part of the Student plan and costs one credit per file; text and Markdown files stay free.',
      'The sign-up confirmation code was being refused as “expired” because the box took six digits and the email carried eight. Fixed. A tab left open across an update now reloads itself instead of going blank.',
    ],
  },
  {
    date: '2026-09-06',
    title: 'One study page',
    items: [
      'Every study tool is on one shelf under one picker: choose a class and its lectures once, then quiz, handbook, paper guide, flashcards and practice questions all work on that selection.',
      'The study timer comes with you instead of living on a separate screen; finishing a session marks its lectures reviewed.',
      'The confirmation email carries the code itself, not only a link.',
    ],
  },
  {
    date: '2026-09-04',
    title: 'Practice questions that work, and promo codes',
    items: [
      'Practice questions and study-session booking were both broken in ways that never showed an error; both are fixed and both now say what went wrong if anything does.',
      'Promo codes at checkout, and a round of fixes for what a phone browser actually hits.',
    ],
  },
  {
    date: '2026-09-03',
    title: 'Desktop apps',
    items: [
      'Praelecta for Windows and Linux, built and published on GitHub. The Mac app is built and waiting on testing on a real Mac.',
      'A recording interrupted by a crash or a dead battery is found again the next time the app opens, from anywhere in the app.',
    ],
  },
  {
    date: '2026-09-02',
    title: 'The full study page for every lecture',
    items: [
      'Every recording now becomes a study page: an outline anchored to the transcript, concept cards, formulas and definitions verified against the professor’s slides when you attach them, worked examples, an exam radar, and the to-dos the professor mentioned.',
      'Attach slides, handouts or notes to a lecture; formulas are checked against what the professor actually wrote.',
      'Quiz questions are validated before you see them, so a blank question can no longer appear.',
    ],
  },
  {
    date: '2026-09-01',
    title: 'Reviews on your day',
    items: [
      'Review sessions use your local day, and the first review after a lecture is booked for that evening.',
    ],
  },
  {
    date: '2026-08-21',
    title: 'Praelecta opens to its first students',
    items: [
      'Record a lecture, get the transcript, summary and flashcards; tick what the test covers; let the study sessions book themselves. Two lectures free.',
    ],
  },
];

const longDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

export default function Changelog() {
  return (
    <MarketingShell
      title="What’s new — Praelecta"
      description="Everything that shipped in Praelecta, with dates: new study tools, fixes, and the desktop apps.">
      <section className="px-4 pb-20 pt-28 sm:px-6 sm:pt-32">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm font-semibold text-primary">What&rsquo;s new</p>
          <h1 className="mt-2 text-4xl font-bold tracking-[-0.045em] text-foreground sm:text-5xl">What shipped, and when.</h1>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Praelecta is built by one person who uses it every week, so it changes often. This is the list, newest first.
            Desktop app builds and their checksums are on <a href={DESKTOP_RELEASES_URL} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:text-foreground">GitHub</a>.
          </p>

          <ol className="mt-10 space-y-6">
            {CHANGELOG.map((entry) => (
              <li key={entry.date} className="rounded-[26px] border border-border bg-card p-6 sm:p-7">
                <time dateTime={entry.date} className="text-xs font-bold uppercase tracking-[0.12em] text-primary">{longDate(entry.date)}</time>
                <h2 className="mt-2 text-xl font-bold tracking-[-0.03em] text-foreground">{entry.title}</h2>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
                  {entry.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </li>
            ))}
          </ol>

          <div className="mt-10">
            <Link to="/register" className="auth-cta inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-primary-foreground">
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
