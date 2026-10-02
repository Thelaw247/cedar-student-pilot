import { FOUNDER } from './founder.js';
import { TIERS } from './tiers.js';

/**
 * Every public page's title and description, in one place.
 *
 * Three readers, so they cannot drift: the page itself (MarketingShell or
 * usePublicPageMeta writes them into the document at runtime), the build
 * (vite.config.js writes a copy of index.html per route with these in its
 * <head>, because a crawler that does not run JavaScript otherwise sees the
 * homepage's description on every route — the 22 Sep audit scored exactly
 * that), and the sitemap test, which insists every page here is listed and
 * routed.
 *
 * Descriptions say what the page is, in the words a student would search
 * with, and stay under ~160 characters so a search snippet shows the whole
 * line. Prices are read from tiers.js: a description that quotes a price is
 * a description that goes stale the first time the price changes.
 */

export const SITE_ORIGIN = 'https://praelecta.ca';

const money = (n) => `$${n.toFixed(2)}`;

export const LANDING_TITLE = 'Praelecta — AI Lecture Recording & Study Tool for Students';
// The same string index.html serves; a test keeps the two equal.
export const LANDING_DESCRIPTION = 'Record your lecture — Praelecta turns it into a transcript, flashcards, practice questions and a study plan, automatically. Two lectures free.';

export const PUBLIC_PAGES = {
  '/': { title: LANDING_TITLE, description: LANDING_DESCRIPTION },
  '/pricing': {
    title: 'Pricing — Praelecta',
    description: `Praelecta pricing: two lectures free, then ${money(TIERS.student.monthly)}/month or ${money(TIERS.student.semester)}/semester. Credit packs, plan comparison, and semester savings.`,
  },
  '/about': {
    title: 'About — Praelecta',
    description: `Praelecta was built by ${FOUNDER.name}, an engineering student at the University of Saskatchewan, so every student can give the lecture their full attention.`,
  },
  '/changelog': {
    title: 'What’s new — Praelecta',
    description: 'What shipped in Praelecta, newest first. Desktop apps, study tools, and lecture features, dated.',
  },
  '/privacy': {
    title: 'Privacy policy — Praelecta',
    description: 'What Praelecta stores about you, which providers process your recordings and why, what is never done with them, and how to export or delete everything.',
  },
  '/terms': {
    title: 'Terms of service — Praelecta',
    description: 'Praelecta’s terms in plain words: what each plan includes, how credits work, cancelling in two clicks, refunds, and what the app will never do to you.',
  },
  '/vs/lemora': {
    title: 'Praelecta vs Lemora — Praelecta',
    description: 'Praelecta and Lemora both record the lecture and build the study material. The differences: test scoping, a study schedule that books itself, semester billing.',
  },
  '/vs/scholarly': {
    title: 'Praelecta vs Scholarly — Praelecta',
    description: 'Scholarly is a 25-tool workspace for documents; Praelecta is built around the lecture. Recording, flashcards, test scoping, scheduling and price, compared.',
  },
  '/vs/studr': {
    title: 'Praelecta vs Studr — Praelecta',
    description: 'Studr turns one upload into a study set with spaced repetition; Praelecta records the whole term and schedules the studying. Side by side, with prices.',
  },
  '/vs/studley': {
    title: 'Praelecta vs Studley AI — Praelecta',
    description: 'Studley AI turns one upload into a study set with a tutor chat; Praelecta records the whole term, scopes the exam and books the studying. Compared, with prices.',
  },
  '/vs/turbo': {
    title: 'Praelecta vs Turbo AI — Praelecta',
    description: 'Turbo AI makes editable notes and activities from any file; Praelecta records the lecture, knows what the test covers and schedules the sessions. Compared, with prices.',
  },
  // The feature pages (28 Sep 2026 audit): the long form of each homepage
  // section, on the URL a search for that feature should land on.
  '/lecture-recorder': {
    title: 'AI lecture recorder for university classes — Praelecta',
    description: 'Record a lecture of up to six hours and leave with the transcript, a plain-English summary, the formulas and every "this is on the exam" moment, filed under the course.',
  },
  '/test-coverage': {
    title: 'Study only what is on the test — Praelecta',
    description: 'Tick the lectures your prof said the midterm covers. Flashcards, practice questions and reviews stay inside that slice, so nothing on the test is new to you.',
  },
  '/study-schedule': {
    title: 'AI study schedule around your classes and shifts — Praelecta',
    description: 'Give Praelecta the exam date and the study sessions are booked into real gaps around your classes, work shifts and deadlines, spread across the days before.',
  },
  '/study-system': {
    title: 'Study tools built from your lectures — Praelecta',
    description: 'Flashcards, quizzes, practice tests, summary sheets, a class handbook and focus sessions, all made from the lectures you recorded, none of it rebuilt by hand.',
  },
};

/** Paths in the order the sitemap lists them. */
export const PUBLIC_PATHS = Object.keys(PUBLIC_PAGES);

/** The absolute URL of a public page, for canonical and og:url tags. */
export const publicPageUrl = (path) => `${SITE_ORIGIN}${path === '/' ? '/' : path}`;
