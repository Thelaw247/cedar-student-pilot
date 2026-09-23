import { TIERS, CREDIT_COSTS } from './tiers.js';

/**
 * The three comparison pages (/vs/lemora, /vs/scholarly, /vs/studr).
 *
 * Every line in a competitor's column is a fact read from that company's own
 * website or app-store listing on the date in `checkedOn`, and the pages it
 * came from are listed under `sources` so a visitor can check. Where a site
 * does not say something, the cell says so — "not stated on their site" —
 * rather than guessing, and nothing here is an opinion about their quality.
 * Their prices are in US dollars and Praelecta's in Canadian, which the
 * table says out loud instead of converting.
 *
 * Praelecta's column is built from tiers.js, so a price change here is a
 * price change everywhere. Re-check the competitor pages each term and move
 * `checkedOn`; a stale comparison is worse than none.
 *
 * "When to pick them" is written to be true, not flattering: the pages exist
 * because a student typing "Praelecta vs Lemora" is choosing, and they can
 * tell when a comparison only argues one way.
 */

const money = (n) => `$${n.toFixed(2)}`;
const perHour = CREDIT_COSTS.perThirtyMinutes.process_lecture * 2;

/** Praelecta's side of every table, from the same data the pricing page reads. */
export const PRAELECTA_FACTS = {
  recording: 'Yes. Press record in class; up to six hours, in the browser, the desktop app (Windows, Mac, Linux) or on a phone. A crash or a dead battery is recovered next time the app opens.',
  afterClass: 'A transcript, a plain-English summary, the formulas and definitions, worked examples, and every "this is on the exam" moment, filed under the course before you get home.',
  practice: 'Flashcards, practice questions and quizzes, built from your lectures — and from the professor’s own files (syllabus, formula sheet, past exam) when you attach them.',
  examScoping: 'Yes. Tick the lectures the test covers and every flashcard, question and review stays inside that slice.',
  scheduling: 'Yes. Give it the exam date and the study sessions are booked into real gaps around your classes, shifts and deadlines; a missed one is rebooked.',
  platforms: 'Web (any phone or laptop), desktop apps for Windows, Mac and Linux. iPhone app on the way.',
  freeTier: 'Two full lectures, no card — the whole pipeline on your own class.',
  price: `Student ${money(TIERS.student.monthly)} CAD a month or ${money(TIERS.student.semester)} a semester (about ${TIERS.student.creditsPerMonth / perHour} one-hour lectures a month). Scholar ${money(TIERS.scholar.monthly)} / ${money(TIERS.scholar.semester)}, Unlimited ${money(TIERS.unlimited.monthly)} / ${money(TIERS.unlimited.semester)}. Credit packs never expire.`,
  billing: 'Monthly, or by the semester (four months for one payment). Cancel in one tap; the price you join at never goes up while you stay.',
  privacy: 'Recordings are private to your account and never used to train anything. The providers that touch them (Groq, Deepgram, Google Gemini) are named in the privacy policy, with what each is allowed to do.',
  scope: 'Lectures only. Praelecta does not write essays or assignments.',
};

export const COMPARISON_ROWS = [
  { id: 'recording', label: 'Records the lecture live' },
  { id: 'afterClass', label: 'What you have after class' },
  { id: 'practice', label: 'Flashcards and practice questions' },
  { id: 'examScoping', label: 'Scope studying to what the test covers' },
  { id: 'scheduling', label: 'Study schedule around your calendar' },
  { id: 'platforms', label: 'Where it runs' },
  { id: 'freeTier', label: 'Free tier' },
  { id: 'price', label: 'Price' },
  { id: 'billing', label: 'Billing' },
  { id: 'privacy', label: 'Your recordings and privacy' },
  { id: 'scope', label: 'Assignments and essays' },
];

export const COMPETITORS = [
  {
    slug: 'lemora',
    name: 'Lemora',
    url: 'https://www.lemora.ai/',
    tagline: 'Record the lecture. Get the study guide.',
    summary: 'Lemora is an iPhone-first lecture recorder that turns a class, a PDF, slides or a YouTube video into notes, flashcards and quizzes, with an AI voice tutor and a podcast mode on top.',
    checkedOn: '2026-09-23',
    facts: {
      recording: 'Yes. "Tap record and forget about it." Also uploads: PDFs, slides, YouTube links, Zoom/Teams/Meet recordings. Maximum recording length: not stated on their site.',
      afterClass: 'Organized notes with headings and key concepts, "keeps formulas readable and adds images where they help"; a separate verbatim transcript view is not stated. Plus a podcast of the lecture and mind maps.',
      practice: 'Yes: flashcards and quizzes (multiple choice, short answer, true/false), made from your lectures. A spaced "Smart Review Queue" is listed on the App Store, not on the site.',
      examScoping: 'Not stated on their site. The closest thing is an "Exam readiness" score against an exam date you set.',
      scheduling: 'Not stated. Daily streaks and an exam-readiness score; no calendar or booked sessions on their site.',
      platforms: 'iPhone and iPad app; Macs with Apple silicon; the browser on Android, Windows and Chromebooks. No Android app found.',
      freeTier: '"Free to use, no credit card required" with "daily limits on things like uploads and tutor chats". The limits themselves are not stated.',
      price: 'No prices on their site. The App Store lists Lemora Pro at $14.99 USD a month or $99.99 USD a year.',
      billing: 'Monthly or yearly through the App Store. No semester option. Cancel from account settings.',
      privacy: '"We do NOT use your personal content to train our AI models or any third-party models." Content is shared with model and transcription providers "including OpenAI and Anthropic" to generate materials.',
      scope: 'Not stated on their site.',
    },
    whenPraelecta: [
      'You want the exam handled, not only the notes: tick what the test covers and have the study sessions booked around your week.',
      'You want to pay once for the term. Praelecta bills by the semester; Lemora bills monthly or yearly.',
      'You want your recordings on a Windows or Linux laptop, or in a desktop app that opens straight to today.',
      'You want to know, before you record, exactly which companies touch the audio and what they may do with it.',
    ],
    whenThem: [
      'You want an iPhone app today. Praelecta’s is still on the way; on a phone it runs in the browser.',
      'You study from PDFs, slides and YouTube videos as much as from live lectures.',
      'You would use an AI voice tutor you can talk to, a podcast version of the lecture, or mind maps.',
      'You learn in a language other than English; Lemora lists "more than 100" languages.',
    ],
    sources: [
      'https://www.lemora.ai/',
      'https://www.lemora.ai/ai-lecture-recorder',
      'https://www.lemora.ai/ai-quiz-maker',
      'https://www.lemora.ai/support',
      'https://www.lemora.ai/privacy-policy',
      'https://apps.apple.com/us/app/lemora-ai-notes/id6759946073',
    ],
  },
  {
    slug: 'scholarly',
    name: 'Scholarly',
    url: 'https://scholarly.so/',
    tagline: 'Your work material. Ready to learn from.',
    summary: 'Scholarly is a browser workspace of "25+ AI tools" for documents, recordings and videos — notes, flashcards, quizzes, practice tests, essays, podcasts and video lectures — sold to students, professionals and teams.',
    checkedOn: '2026-09-23',
    facts: {
      recording: 'Yes, in the browser, on a laptop or phone; or upload audio and video files. Free plan transcribes up to 30 minutes per recording, paid plans up to 5 hours.',
      afterClass: 'A timestamped, searchable transcript plus notes in Cornell, outline or summary formats; a summary; and any study material you ask it to build from the recording.',
      practice: 'Yes: editable flashcards with spaced repetition (Anki export on paid plans), quizzes with instant feedback, and full practice tests with multiple-choice, short-answer and essay questions.',
      examScoping: 'Not stated as choosing which lectures a test covers. You can combine up to 10 sources per creation on Premium, 20 on Laureate.',
      scheduling: 'Spaced repetition and study sessions, and an "AI Study Schedule Generator" tool. Booking sessions into your own calendar is not stated.',
      platforms: 'Browser only, on any laptop, tablet or phone — "nothing to download or install". No native app is listed.',
      freeTier: '"Free forever", no card: 1 file upload (8 MB), 3 AI chat messages, 5 quiz questions, 1 practice exam, one recording with 30 minutes of transcription.',
      price: 'Premium $12 USD a month billed yearly ($144), or $30 USD month to month. Laureate $99 USD a month. Team plans from $28 USD a seat a month.',
      billing: 'Yearly or monthly. No semester option. Cancel any time and keep access to the end of the period; refunds within 30 days of a first purchase, which may be declined for "extensive or sustained use".',
      privacy: '"Scholarly does not use private User Content to train general-purpose AI models by default." Sub-processors listed include OpenAI, Anthropic, Google and xAI. Based in the United States.',
      scope: 'Yes: "Plan, draft, and refine essays with AI that adapts to your own writing voice", plus slides, spreadsheets and worksheets.',
    },
    whenPraelecta: [
      'You want one app built around the lecture, not a workspace of 25 tools to learn.',
      'You want the term to schedule itself: booked study sessions around your classes and shifts, rebooked when life happens.',
      'You want to study only what the test covers, lecture by lecture, without assembling sources by hand each time.',
      'You want student pricing in Canadian dollars, by the semester, with the price frozen for as long as you stay.',
    ],
    whenThem: [
      'You need help writing — essays, slides, worksheets — as well as studying. Praelecta will not write your assignments.',
      'Your material is mostly documents and videos rather than live lectures, and you want to chat across them with citations.',
      'You want video lectures or podcasts generated from your material, or an Anki export.',
      'You are buying for a team or a class rather than for yourself.',
    ],
    sources: [
      'https://scholarly.so/',
      'https://scholarly.so/pricing',
      'https://scholarly.so/faq',
      'https://scholarly.so/features',
      'https://scholarly.so/tools/lecture-recorder',
      'https://scholarly.so/docs/privacy',
      'https://scholarly.so/docs/refund-policy',
    ],
  },
  {
    slug: 'studr',
    name: 'Studr',
    url: 'https://studr.app/',
    tagline: 'Turn any PDF, lecture, or video into a study set that sticks',
    summary: 'Studr turns one upload — a PDF, a lecture recording, a YouTube video, slides or notes — into a summary, flashcards and a quiz, and schedules the flashcards for review with spaced repetition, on iOS, Android and the web.',
    checkedOn: '2026-09-23',
    facts: {
      recording: 'Yes: "Hit record in class" or upload audio; transcribed with timestamps. Maximum recording length: not stated on their site.',
      afterClass: 'A timestamped transcript with audio playback, a structured summary, flashcards and a quiz — one study set per upload. Chat with your notes on Premium.',
      practice: 'Yes: flashcards scheduled with spaced repetition ("a small stack daily instead of cramming") and a multiple-choice quiz with instant feedback for every upload.',
      examScoping: 'Not stated on their site.',
      scheduling: 'Spaced-repetition review of flashcards at expanding intervals. Booking study sessions into a calendar is not stated.',
      platforms: 'iOS and Android apps, and the web. The App Store listing also runs on Apple-silicon Macs.',
      freeTier: 'One upload of any file type, with the full output, no card required.',
      price: 'Premium $14.99 USD a month, or $89.99 USD a year (about $7.50 a month). "Local currency and applicable taxes may appear at checkout."',
      billing: 'Monthly or yearly. No semester option. Cancel from the app or the app store; refunds "case-by-case", typically within 14 days.',
      privacy: '"We do not use your uploaded content to train third-party AI models beyond what is needed to process your individual request." Providers named: OpenAI, Google (Gemini), AssemblyAI.',
      scope: 'Not stated on their site.',
    },
    whenPraelecta: [
      'You record a whole term, not one file at a time: every lecture lands under its course, and the exam-coverage map keeps track of what has been studied.',
      'You want the studying scheduled for you — sessions with dates, around your real week — rather than a daily flashcard stack.',
      'You want to scope a test to the lectures it actually covers.',
      'You want to pay in Canadian dollars, by the semester, and know the price will not rise while you stay.',
    ],
    whenThem: [
      'You want an Android app today.',
      'You mostly study from PDFs and videos, one at a time, and a spaced-repetition flashcard stack is the routine you want.',
      'Yearly billing suits you: Studr’s yearly plan works out to about $7.50 USD a month.',
      'You want to chat with your own notes.',
    ],
    sources: [
      'https://studr.app/',
      'https://studr.app/pricing/',
      'https://studr.app/flashcards/',
      'https://studr.app/support/',
      'https://studr.app/privacy/',
      'https://apps.apple.com/us/app/studr-ai-notetaker/id6752513673',
      'https://play.google.com/store/apps/details?id=com.studr.notes',
    ],
  },
];

export const COMPETITOR_SLUGS = COMPETITORS.map((c) => c.slug);
export const competitorBySlug = (slug) => COMPETITORS.find((c) => c.slug === slug) || null;
