/**
 * The four feature pages (/lecture-recorder, /test-coverage, /study-schedule,
 * /study-system), from the 28 Sep 2026 landing-page audit.
 *
 * The homepage now shows each feature in its short form; the long version
 * — the full section with its mock, the research notes, the tool list —
 * lives on the feature page, which is also the page a search for "AI lecture
 * recorder" or "study schedule app" should land on (the competitors own those
 * searches with a page per feature; Praelecta had one homepage anchor each).
 *
 * `label` is the short name for nav and footer links, `section` names the
 * landing component the page renders in full, `faq`
 * lists the FAQ ids (shared/faq.js) answered under it, and `cta` is the
 * button, worded as the result the visitor is after. Titles and descriptions
 * live in publicPages.js with every other public page's, so the build writes
 * each route its own <head>.
 */
export const FEATURES = [
  {
    slug: 'lecture-recorder',
    label: 'Lecture recorder',
    path: '/lecture-recorder',
    section: 'recording',
    eyebrow: 'Lecture recording',
    h1: 'Record the lecture. Leave with the notes.',
    intro: 'Press record when class starts. When it ends, the lecture is filed under the course with a transcript, a plain-English summary, the formulas, and every moment your prof said "this is on the midterm". Up to six hours, in the browser or the desktop app.',
    faq: ['allowed', 'audio', 'fast', 'devices'],
    cta: 'Record your first lecture free',
  },
  {
    slug: 'test-coverage',
    label: 'Test coverage',
    path: '/test-coverage',
    section: 'test-coverage',
    eyebrow: 'Exact test coverage',
    h1: 'Study only what is actually on the test.',
    intro: 'Tick the lectures your prof said the midterm covers. Every flashcard, practice question and review stays inside that slice, so an off-syllabus chapter never eats your evening and nothing on the test is the first time you have seen it.',
    faq: ['credits', 'essays', 'price'],
    cta: 'Try it on this week’s lecture',
  },
  {
    slug: 'study-schedule',
    label: 'Study schedule',
    path: '/study-schedule',
    section: 'study-schedule',
    eyebrow: 'Study scheduling',
    h1: 'Give it the exam date. The studying books itself.',
    intro: 'The sessions are spread across the days before the test and dropped into real gaps around your classes, work shifts and deadlines, with a lighter review the night before. Miss one and it is rebooked.',
    faq: ['credits', 'cancel', 'price'],
    cta: 'Start free',
  },
  {
    slug: 'study-system',
    label: 'Study tools',
    path: '/study-system',
    section: 'study-system',
    eyebrow: 'The complete study system',
    h1: 'Every study tool, from the same class.',
    intro: 'Flashcards, quizzes, practice tests, summary sheets, a class handbook and focus sessions with a review at the end — all built from the lectures you recorded, none of it rebuilt by hand. Open a session and the material is already waiting.',
    faq: ['credits', 'essays', 'devices', 'price'],
    cta: 'Start free',
  },
];

export const FEATURE_PATHS = FEATURES.map((f) => f.path);
export const featureBySlug = (slug) => FEATURES.find((f) => f.slug === slug) || null;
