/**
 * The four feature pages (/lecture-recorder, /test-coverage, /study-schedule,
 * /study-system), from the 28 Sep 2026 landing-page audit.
 *
 * The homepage shows each feature as one tile in its feature grid; the long
 * version (the full section with its mock, the research notes, the tool
 * list) lives on the feature page, which is also the page a search for "AI
 * lecture recorder" or "study schedule app" should land on.
 *
 * `label` is the short name for nav and footer links, `section` names the
 * landing component the page renders in full, `blurb` is the one line the
 * homepage's feature grid shows under the label (under twenty-five words, a
 * test holds it there), `faq` lists the FAQ ids (shared/faq.js) answered
 * under it, and `cta` is the button, worded as the result the visitor is
 * after. Titles and descriptions live in publicPages.js with every other
 * public page's, so the build writes each route its own <head>.
 */
export const FEATURES = [
  {
    slug: 'lecture-recorder',
    label: 'Lecture recorder',
    path: '/lecture-recorder',
    section: 'recording',
    eyebrow: 'Lecture recording',
    blurb: 'Up to six hours without stopping. You leave with the transcript, a summary, the formulas and the “this is on the midterm” moments.',
    h1: 'Record the lecture. Leave with the notes.',
    intro: 'Press record when class starts. When it ends, the lecture is filed under the course with a transcript, a plain-English summary, the formulas, and the moments your prof said "this is on the midterm" flagged. Up to six hours, in the browser or the desktop app.',
    faq: ['allowed', 'audio', 'fast', 'devices'],
    cta: 'Record your first lecture free',
  },
  {
    slug: 'test-coverage',
    label: 'Test coverage',
    path: '/test-coverage',
    section: 'test-coverage',
    eyebrow: 'Exact test coverage',
    blurb: 'Tick the lectures the test covers. Flashcards, practice questions and reviews stay inside those lectures.',
    h1: 'Study only what is actually on the test.',
    intro: 'Tick the lectures your prof said the midterm covers. Every flashcard, practice question and review stays inside that slice, so an off-syllabus chapter never eats your evening.',
    faq: ['credits', 'essays', 'price'],
    cta: 'Try it on this week’s lecture',
  },
  {
    slug: 'study-schedule',
    label: 'Study schedule',
    path: '/study-schedule',
    section: 'study-schedule',
    eyebrow: 'Study scheduling',
    blurb: 'Give it the exam date. The sessions land in real gaps around your classes, shifts and deadlines, with a light review the night before.',
    h1: 'Give it the exam date. The studying books itself.',
    intro: 'The sessions are spread across the days before the test and dropped into real gaps around your classes, work shifts and deadlines, with a lighter review the night before. Miss one and you can rebook it in a tap.',
    faq: ['credits', 'cancel', 'price'],
    cta: 'Create your free account',
  },
  {
    slug: 'study-system',
    label: 'Study tools',
    path: '/study-system',
    section: 'study-system',
    eyebrow: 'The complete study system',
    blurb: 'Flashcards, quizzes, practice tests, summary sheets, a class handbook and focus sessions, all built from your own lectures.',
    h1: 'Every study tool, from the same class.',
    intro: 'Flashcards, quizzes, practice tests, summary sheets, a class handbook and focus sessions with a review at the end, all built from the lectures you recorded, none of it rebuilt by hand. Open a session and the material is already waiting.',
    faq: ['credits', 'essays', 'devices', 'price'],
    cta: 'Study your first lecture free',
  },
];

export const FEATURE_PATHS = FEATURES.map((f) => f.path);
export const featureBySlug = (slug) => FEATURES.find((f) => f.slug === slug) || null;
