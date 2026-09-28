import { TIERS, CREDIT_COSTS } from './tiers.js';

/**
 * The comparison pages (/vs/lemora, /vs/scholarly, /vs/studr, /vs/studley,
 * /vs/turbo) and the short "at a glance" table on the homepage.
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

/**
 * The homepage's at-a-glance table (28 Sep 2026 audit, change 11): one line
 * per cell, the same facts as the long columns below, against the two apps
 * a student is most likely to have seen first. `PRAELECTA_GLANCE` reads
 * tiers.js like everything else; each competitor carries its own `glance`.
 */
export const PRAELECTA_GLANCE = {
  billing: `${money(TIERS.student.semester)} CAD for the semester, or ${money(TIERS.student.monthly)} a month`,
  freeTier: 'Two full lectures, no card, nothing expires',
  examScoping: 'Yes — tick the lectures the prof said count',
  scheduling: 'Yes, around classes and shifts (Scholar plan)',
  recording: 'Up to six hours',
  scope: 'Never — lectures only',
  cancel: 'One tap in Settings',
};

export const GLANCE_ROWS = [
  { id: 'billing', label: 'Billing' },
  { id: 'freeTier', label: 'Free tier' },
  { id: 'examScoping', label: 'Knows what is on the exam' },
  { id: 'scheduling', label: 'Books the study sessions' },
  { id: 'recording', label: 'Recording length' },
  { id: 'scope', label: 'Assignments' },
  { id: 'cancel', label: 'Cancelling' },
];

/** The competitors on the homepage table, in column order. */
export const GLANCE_COMPETITORS = ['studley', 'turbo'];

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
  {
    slug: 'studley',
    name: 'Studley AI',
    url: 'https://www.studley.ai/',
    tagline: 'Learn Faster... Like, a Lot Faster',
    summary: 'Studley AI turns lecture slides, notes, PDFs, recordings and YouTube videos into flashcards, quizzes, written tests, a tutor chat and audio podcasts — one study set per upload — on the web, iOS and Android, and sells itself against private tutors.',
    checkedOn: '2026-09-28',
    facts: {
      recording: 'Uploads of "lecture recordings" are accepted alongside PDFs, notes and YouTube videos ("Upload or Paste Content"). Recording live in class, and a maximum recording length, are not stated on their site.',
      afterClass: 'One "study set" per upload: AI notes and summaries, flashcards, quizzes, written tests, fill-in-the-blanks, a 24/7 tutor chat and an audio podcast. A verbatim transcript view is not stated.',
      practice: 'Yes: "Instant Flashcards", "Smart Quizzes" with explanations for wrong answers, "Written Tests" with feedback, and progress tracking from "unfamiliar" to "mastered".',
      examScoping: 'Not stated. Each upload is its own study set; a paying user on the App Store asks to add the lecture slides to a recording’s set and cannot.',
      scheduling: 'Not stated on their site. No calendar and no booked study sessions.',
      platforms: 'Web app, iOS, Android and tablet ("Study anytime, anywhere"). 1M+ installs on Google Play.',
      freeTier: '"The Free plan allows you to make one study set to show you the value of Studley." App Store reviews describe the paywall after that first set.',
      price: 'On their site: "$3.74/week (billed monthly) or $1.88/week (billed annually)". In the App Store: weekly $7.99–8.99 USD, monthly $13.99–14.99 USD, yearly $97.99 USD.',
      billing: 'Weekly, monthly or yearly, auto-renewing. "All fees are non-refundable unless explicitly stated otherwise or required by law." A "Manage Subscription" link in the footer; no cancellation terms stated.',
      privacy: 'The privacy policy (last updated December 31, 2024) does not say whether uploads are used to train AI models and does not name the AI providers that process them; it references PIPEDA where relevant.',
      scope: 'Yes: "Homework Help & Assignment Support", "Smart Paper Grading: Get detailed feedback based on your rubric", and an Essay Grader in the features menu.',
    },
    glance: {
      billing: '$14.99 USD a month or $97.99 a year in the App Store; "$1.88/week" on the site',
      freeTier: 'One study set',
      examScoping: 'No',
      scheduling: 'No',
      recording: 'Not stated',
      scope: 'Essay Grader, Homework Help',
      cancel: '"Manage Subscription" page; fees non-refundable',
    },
    whenPraelecta: [
      'You record whole lectures for a whole term and want them filed under the course, not one study set per upload.',
      'You want to know what the test covers and study only that, with the sessions booked around your week.',
      'You want the price in Canadian dollars, by the semester, printed on the page — not a weekly figure charged yearly.',
      'You want to know, before you upload, which companies process your audio and that it is never used for training.',
    ],
    whenThem: [
      'You want an iOS or Android app today; Praelecta on a phone runs in the browser.',
      'You study from PDFs, slides and YouTube videos more than from live lectures, and you want a podcast version.',
      'You want written-answer tests graded against a rubric, or an essay grader.',
      'You want a tutor chat that stands in for a human tutor.',
    ],
    sources: [
      'https://www.studley.ai/',
      'https://www.studley.ai/privacy',
      'https://www.studley.ai/terms',
      'https://apps.apple.com/us/app/studley-ai-study-tutor/id6744783834',
      'https://play.google.com/store/apps/details?id=ai.studley.app&hl=en_US',
    ],
  },
  {
    slug: 'turbo',
    name: 'Turbo AI',
    url: 'https://www.turbo.ai/',
    tagline: 'The fastest way to learn anything.',
    summary: 'Turbo AI (formerly TurboLearn) turns lectures, PDFs, YouTube videos and notes into editable notes, flashcards, quizzes and podcasts, with pre-made AP study guides and shared docs, on the web, iOS and Android.',
    checkedOn: '2026-09-28',
    facts: {
      recording: 'Yes: "Turbo AI listens to your lectures and takes perfect notes" — "Record & Transcribe Instantly" with "key points, timestamps, and highlights". A maximum recording length is not stated on their site.',
      afterClass: 'Editable notes in a Google Docs-style editor, a transcript, a chat that "indexes and deeply comprehends your notes", flashcards, quizzes and a podcast of the material, in folders that sync across devices.',
      practice: 'Yes: "Practice until it clicks. Endless questions until you lock in understanding" — multiple-choice, fill-in-the-blank and written questions, plus flashcards.',
      examScoping: 'Not stated. Notes and activities are made per upload; nothing on their site ties material to the lectures an exam covers.',
      scheduling: 'Not stated on their site. No calendar and no booked study sessions.',
      platforms: 'Web, iOS and Android ("Stay synced. Learn on the go across our website and mobile app"). 1M+ installs on Google Play.',
      freeTier: '"A generous free tier that includes note generation, flashcards, and quizzes"; the limits are not stated on the site. Reviewers report one or two free uploads before the paywall.',
      price: 'No prices on their site. In the App Store: $9.99 USD a week, $14.99–19.99 USD a month, $19.99–119.99 USD a year, and a "50% Off Forever Monthly" offer at $7.49 USD.',
      billing: 'Monthly or annual, auto-renewing; cancel in account settings at least 24 hours before the term ends. "All fees are non-refundable and non-creditable, including for partial periods, except where required by law."',
      privacy: '"We may use your Personal Information to further develop our artificial intelligence and improve our Service." Content is processed by external providers, "currently OpenAI®, Grok®, Anthropic®, and Modal Labs". Based in Frisco, Texas.',
      scope: 'Notes and activities from any file, plus "Your Collaborative AI Teammate" that makes "comments, suggestions and rewrites" as you write. Assignments are not excluded.',
    },
    glance: {
      billing: '$14.99–19.99 USD a month, up to $119.99 a year in the App Store; no prices on the site',
      freeTier: 'Limits not stated; reviewers report two uploads, then a paywall',
      examScoping: 'No',
      scheduling: 'No',
      recording: 'Not stated',
      scope: 'Notes and activities from any file',
      cancel: 'Account settings, 24 hours before renewal; fees non-refundable',
    },
    whenPraelecta: [
      'You want the exam handled, not only the notes: tick what the test covers and have the study sessions booked around your classes and shifts.',
      'You want to pay once for the term, in Canadian dollars, and see the price before you sign up.',
      'You want your recordings kept out of anyone’s model training, with the providers named.',
      'You want a study app that will not touch your assignments, so there is nothing to explain to an integrity office.',
    ],
    whenThem: [
      'You want an iOS or Android app today.',
      'You want editable notes you can share and co-edit with classmates, or pre-made AP study guides.',
      'You study from PDFs, YouTube videos and slides as much as from live lectures, and you want a podcast version.',
      'You want an app with hundreds of thousands of public reviews to read before you decide.',
    ],
    sources: [
      'https://www.turbo.ai/',
      'https://www.turbo.ai/ai-note-taker',
      'https://www.turbo.ai/privacy-policy',
      'https://www.turbo.ai/terms-of-service',
      'https://apps.apple.com/us/app/turbo-ai-notetaker/id6502794561',
      'https://play.google.com/store/apps/details?id=ai.turbolearn&hl=en_US',
    ],
  },
];

export const COMPETITOR_SLUGS = COMPETITORS.map((c) => c.slug);
export const competitorBySlug = (slug) => COMPETITORS.find((c) => c.slug === slug) || null;
