/**
 * Single source of truth for tiers, prices and credit packs.
 *
 * The pricing page, the Settings subscription panel, the upsell prompts and the
 * Stripe checkout call all read from here, so they cannot drift apart. Same
 * pattern as navItems.js.
 *
 * All amounts CAD. Costs to serve are modelled in the finance workbook; these
 * are sell prices only.
 *
 * STRIPE INTEGRATION: fill in the price IDs after creating the products in
 * Stripe. Nothing else in the app needs to change.
 */

export const TIERS = {
  free: {
    id: 'free',
    name: 'Free',
    blurb: 'Everything you need to see what Cedar does.',
    monthly: 0,
    semester: 0,
    creditsPerMonth: 20,
    lifetimeOnly: true, // free credits are a one-off grant, not a monthly refresh
    stripe: { monthlyPriceId: null, semesterPriceId: null },
    includes: [
      'Full exam coverage map',
      'Unlimited typed-note lectures',
      '2 recorded lectures (lifetime)',
      'Flashcards and practice quizzes',
      'Calendar, focus mode and analytics',
    ],
    excludes: ['Class handbooks', 'Exam topic prediction', 'AI study schedules'],
  },
  student: {
    id: 'student',
    name: 'Student',
    blurb: 'For one busy semester.',
    monthly: 9.99,
    semester: 29.99,
    creditsPerMonth: 60,
    stripe: { monthlyPriceId: null, semesterPriceId: null },
    includes: [
      'Everything in Free',
      '~6 recorded lectures a month',
      'Class handbooks',
      'Exam topic prediction',
      'AI study schedules',
      'Cleaned "Professor\'s Voice" transcripts',
    ],
  },
  scholar: {
    id: 'scholar',
    name: 'Scholar',
    blurb: 'For a full course load.',
    monthly: 16.99,
    semester: 54.99,
    creditsPerMonth: 150,
    stripe: { monthlyPriceId: null, semesterPriceId: null },
    includes: [
      'Everything in Student',
      '~15 recorded lectures a month',
      'Handbooks for every class',
      'Full proficiency history',
    ],
  },
  unlimited: {
    id: 'unlimited',
    name: 'Unlimited',
    blurb: 'Record everything, every day.',
    monthly: 29.99,
    semester: 99.99,
    creditsPerMonth: 400,
    fairUseHoursPerSemester: 250,
    stripe: { monthlyPriceId: null, semesterPriceId: null },
    includes: [
      'Everything in Scholar',
      'Record every lecture and lab',
      'Priority processing',
      'Fair use: 250 hours a semester',
    ],
  },
};

export const TIER_ORDER = ['free', 'student', 'scholar', 'unlimited'];

/** One-off credit packs. No subscription needed; all features unlock while balance > 0. */
export const CREDIT_PACKS = [
  { id: 'topup',    name: 'Top-up',   credits: 100,  price: 5.99,  stripePriceId: null },
  { id: 'standard', name: 'Standard', credits: 250,  price: 12.99, stripePriceId: null },
  { id: 'bulk',     name: 'Bulk',     credits: 600,  price: 24.99, stripePriceId: null },
  { id: 'semester', name: 'Semester', credits: 1500, price: 49.99, stripePriceId: null },
];

/**
 * What each action costs in Cedar credits. MUST stay in sync with
 * base44/shared/credits.ts — that file is the enforcing copy; this one is for
 * display only. The server is always the authority.
 */
export const CREDIT_COSTS = {
  perThirtyMinutes: { process_lecture: 5, clean_transcript: 3 },
  flat: {
    handbook: 5,
    lecture_review: 2,
    missed_summary: 2,
    project_roadmap: 2,
    study_material: 1,
    exam_prediction: 1,
    study_schedule: 1,
    smart_rebook: 1,
    session_review: 1,
    timetable_import: 0,
  },
};

/** ~1 lecture, for translating credits into something a student understands. */
export const CREDITS_PER_LECTURE = 10;

export const tierOf = (id) => TIERS[id] || TIERS.free;
export const nextTierUp = (id) => {
  const i = TIER_ORDER.indexOf(id);
  return i >= 0 && i < TIER_ORDER.length - 1 ? TIERS[TIER_ORDER[i + 1]] : null;
};

/** Friendly copy for a 402 from the server. */
export function limitMessage(feature, required, balance) {
  return `This needs ${required} credits and you have ${balance}. Top up or upgrade to keep going — your work is saved either way.`;
}
