import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import MarketingShell from '@/components/landing/MarketingShell';
import { DESKTOP_RELEASES_URL } from '@/lib/desktopDownloads';
import { PUBLIC_PAGES } from '@/lib/publicPages';

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
    date: '2026-10-06',
    title: 'A real player, files from a link, and a calmer Today',
    items: [
      'Recordings play with their own controls: play and pause, 15 seconds back, 30 forward, a speed from 1× to 2× that is remembered, and a scrubber you can drag. A lecture you leave halfway picks up where you were. A lecture recorded in more than one part plays all of it. While it plays, a small bar follows you down the transcript so pause is never far, and your phone’s lock screen shows the controls too.',
      'Course files can come from a link. Paste the address of a PDF, or a Google Drive, Dropbox or OneDrive share link, and we fetch the file, check that it really is a PDF or text and carries nothing a document should not (scripts, programs, embedded files), then read it like an upload. Same credit, same place.',
      'Today opens on what is next and how the day is going. Before anything is done it says “4 things today” instead of 0%. Questions and nudges come after that, and a slipped session or a quiet week is an amber note, not a red alarm. Booked study blocks show their end time, and free time reads as “2h 10m free”.',
      'The To-do page shows your progress once something is done, adds a task in one line with Today and Tomorrow a tap away, keeps the class you are looking at, and stops repeating “Task” on every row.',
      'On a lecture page, Delete moved to the very end, away from Quick quiz, and asks before it acts.',
    ],
  },
  {
    date: '2026-10-05',
    title: 'The study page starts with the reason',
    items: [
      'Under the class you picked, a card says what is next for it: the nearest exam or deadline with the days left, how many of its lectures you have reviewed, and the sitting you booked, with one tap to select the lectures still to do and one to start the booked session on the clock.',
      'Each lecture in the list says when you last reviewed it. A long list shows the latest eight and folds the start of the term behind one tap, instead of a box that scrolls inside the page.',
      'Quiz me is the one tool that leads: full width, with the selection written on it (“On all 5 lectures”), and the handbook and paper guide as a pair beneath it. Today’s lectures and This week say how many lectures they would cover.',
      'Making flashcards, practice questions or a summary sheet is one box: pick one, press Make, and a line under the button says what it will read. While it runs it says what it is doing, and when it is done it says how many it made and that they are saved. A summary sheet says it is shown here only.',
      'Starting a booked session from anywhere now sets the lecture list to that session’s lectures, so the clock, the list and the quiz agree.',
    ],
  },
  {
    date: '2026-10-04',
    title: 'Your first lecture, announced',
    items: [
      'When a lecture finishes processing, a small notice says so wherever you are in the app, with a button that opens it. The first lecture you ever finish gets a card of its own: what came out of one tap on Record, that it stays yours, and the one next step.',
      'The study page with nothing in it shows one next step (add your classes, or record a lecture in this one) instead of a row of greyed-out tools.',
      'On Today, until your first recording, the next class says when to press Record. The browser no longer asks for notification permission the moment Today opens; a switch in Settings → Notifications ("Between classes") asks for it when you turn it on.',
      'A brand-new semester no longer gets a red "not much study time this week" card in its first week.',
      'The welcome steps count the account you just made as the first step done, and the plan sheet says in one line that cancelling is one tap, that everything you made stays yours, and that checkout is by Stripe.',
    ],
  },
  {
    date: '2026-10-04',
    title: 'Faster to open, fewer words in the way',
    items: [
      'The Study page opens in a fraction of the time. It used to ask the server for each class one at a time; now it asks once for everything, and the practice tools no longer wait for the deadlines list before they appear.',
      'Today draws itself from what it showed you last and refreshes underneath, so coming back to it is instant. The app itself is a quarter smaller to download: analytics code is only fetched if you have said yes to it.',
      'The attendance question is a card on Today instead of a pop-up over it, and the review ask comes after your schedule, not before it.',
      'Dates read like dates everywhere: “Sun, Sep 27” instead of “2026-09-27”. A lecture that has no title yet is called “Lecture on Sep 27”, and class times show as “8:30 AM”.',
      'On a class page the latest week starts open and the course files sit below the lectures. On a lecture page the plan card sits below the notes it describes, the print and email buttons fit a phone, and “Exam radar” is “Exam hints”.',
      'Settings leads with your plan and your account, and the sections most people never touch start closed. Most of the app’s labels and notices were rewritten in plain words, in sentence case, with the dashes gone.',
      'The class list no longer spills off the side of a phone screen.',
    ],
  },
  {
    date: '2026-10-03',
    title: 'Nothing lost, nothing charged twice',
    items: [
      'Going back no longer loses what you typed. A deadline, event, study block, class, review or project you had not saved yet, and a semester you were still correcting, are there when you come back to them in the same tab, until you save or close them.',
      'Tapping something that costs credits twice runs it once and charges once, even when the second tap gets through.',
      'On a phone, form sheets and the recording island sit above the keyboard instead of under it, and the bottom bar steps aside while you type.',
      'Errors are sentences now. A dropped connection says so, a problem on our side says to try again in a moment, and pop-up alerts became notices that close on their own. Adding an event or a class that could not be saved says so instead of doing nothing.',
      'The strip along the top of a phone screen where notices appear no longer catches taps meant for what is under it.',
      'Dark mode is dark from the first frame instead of flashing light first.',
      'Uploads are checked for what they really are, not what the file name says: a timetable, handout, profile photo or recording that is something else is refused before anything reads it.',
      'Every place you can pay links the Terms and the Privacy Policy next to the refund policy, and the terms have two new short sections: your licence to use the app, and how to report a copyright problem.',
    ],
  },
  {
    date: '2026-10-03',
    title: 'Analytics only with your yes',
    items: [
      'Product analytics only starts if you allow it. A small banner asks once, with two equal buttons, and Settings → Data & Privacy changes your answer any time. A browser that sends Global Privacy Control is never asked.',
      'The free plan covers two full lectures of up to 90 minutes each. If you are on Free, the extra credits are already in your account.',
      'The privacy policy and terms were rewritten against what the app actually does: what is stored, which companies process it and where, a section on cookies and browser storage, and where Export and Delete really are.',
      'The Inter font now comes from praelecta.ca itself instead of Google, and the focus music player uses YouTube’s privacy-enhanced mode.',
      'Plans are shown in hours of lectures instead of a lecture count, every place you can pay links to the refund policy, and Settings only shows switches that change something.',
      'Every button now says what it does to a screen reader, form fields are labelled, pop-up windows close with Escape, and the homepage video has a pause button.',
      'An address that is not a page now says so, in the site’s own design, with a way back. Every screen in the app has its own name in the browser tab, and the Tab key can skip straight past the menu.',
      'Sign-in errors are read out by screen readers. After sign-up, Resend waits out the one-minute email limit instead of failing, and its “New code sent” message closes on its own or with its ✕. A reset email that could not be sent says so, and choosing a new password ends on a screen that says it worked.',
      'After you pay, the confirmation names the plan or the credit pack you bought.',
    ],
  },
  {
    date: '2026-10-02',
    title: 'Your review, in your words',
    items: [
      'Today asks for a quick review: a star rating and a sentence or two. Putting it on praelecta.ca is your choice (the box starts unticked), and Settings → Your review is where you change it, take it off the site or delete it.',
      'The homepage shows what students said, with their stars and only with their say-so, and the average rating once there are enough ratings for it to mean something. The average counts every rating, not only the ones on the page.',
      'The footer is three short columns (Product, Company and Compare) with Privacy, Terms and Sign in underneath.',
      'The homepage headline is a little smaller and reads on two lines on any screen, and the About page says why Praelecta exists in plainer words.',
    ],
  },
  {
    date: '2026-10-01',
    title: 'Today answers back',
    items: [
      'On Today, an attendance answer that could not be saved now says so and what to do next, an answer given offline is saved when you are back on, and “Ask me later” means later.',
      'A recording that will not save tells you the real reason, in the server’s own words instead of “check your connection”, keeps the part that failed to upload for the retry, and offers Discard when there is nothing to send.',
      'On a phone, the sheets for adding an event, adding an exam and rebooking no longer end up under the bottom bar, and the small buttons on Today are big enough for a thumb.',
      'The homepage opens with six words, and the product beside them is the product: a short loop of a real account: a lecture already turned into notes, formulas and an exam radar, two lectures ticked for studying, the week with the sessions booked in. It plays on an iPhone and a Mac too. If your system asks for less motion, or your browser to save data, you get the first frame as a picture instead.',
    ],
  },
  {
    date: '2026-09-29',
    title: 'A homepage you can read in a minute',
    items: [
      'The homepage is seven short sections: what Praelecta does, with the saved lecture beside it; four facts you can check; how it works in three steps, on the real screens; one tile per feature; where it runs; the questions students ask; and the button.',
      'The four promises and the at-a-glance comparison are on the pricing page now, next to the plans they belong with.',
      'The header is four links. The feature pages are in the footer and in the feature grid.',
    ],
  },
  {
    date: '2026-09-28',
    title: 'A shorter homepage, with things you can check',
    items: [
      'The homepage says each thing once: four facts under the first button (six-hour recordings, two full lectures free, the semester price, cancelling in Settings), the person who built it, what the free tier actually includes, and where the notes come from.',
      'Four feature pages (Lecture recorder, Test coverage, Study schedule and Study system) carry the long version of each section, with the questions that belong to it.',
      'Two more comparison pages, Praelecta vs Studley AI and vs Turbo AI, and an at-a-glance table on the homepage against both.',
      'The header is a floating glass bar the page scrolls under.',
    ],
  },
  {
    date: '2026-09-23',
    title: 'Praelecta next to the other study apps',
    items: [
      'Three comparison pages (Praelecta vs Lemora, vs Scholarly and vs Studr) with what each one records, builds, schedules and charges, taken from their own sites on a stated date, and an honest "when to pick them" list on every page.',
      'The homepage says up front that Praelecta bills by the semester, and the study-schedule section says what that is for: being caught up before you are.',
    ],
  },
  {
    date: '2026-09-21',
    title: 'The Mac app, and staying signed in',
    items: [
      'Praelecta for Mac, for Apple silicon and Intel Macs, in the download section on the homepage (desktop app 1.0.4). The first time you open it, macOS asks you to allow it under System Settings, Privacy & Security.',
      'Opening Praelecta while you are signed in no longer asks you to sign in again. The desktop app opens straight on Today, and Sign in on the homepage takes you to your lectures when you are already in.',
      'If the connection drops just as Praelecta opens, a recording waiting to be recovered or uploaded is kept instead of cleared.',
    ],
  },
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
    <MarketingShell {...PUBLIC_PAGES['/changelog']}>
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
              <li key={`${entry.date}:${entry.title}`} className="rounded-[26px] border border-border bg-card p-6 sm:p-7">
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
              Record your first lecture free <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
