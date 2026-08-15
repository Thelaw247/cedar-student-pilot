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
 * STRIPE PRICE IDS ARE DELIBERATELY NOT HERE. The client never sends a price
 * to the server — SubscriptionSettings posts { tier, billing_period } or
 * { pack } and createCheckoutSession resolves the price server-side from
 * base44/shared/stripePrices.ts, which also picks the test or live catalogue
 * automatically from the API key. Mirroring the ids here would be dead config
 * that can only drift out of sync and mislead.
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
    includes: [
      'Everything in Scholar',
      'Record every lecture and lab',
      'Priority processing',
      'Fair use: 250 hours a semester',
    ],
  },
};

export const TIER_ORDER = ['free', 'student', 'scholar', 'unlimited'];

/** One-off credit packs. No subscription needed; all features unlock while balance > 0.
 *  `id` is what the client sends; the server maps it to a Stripe price. */
export const CREDIT_PACKS = [
  { id: 'topup',    name: 'Top-up',   credits: 100,  price: 5.99 },
  { id: 'standard', name: 'Standard', credits: 250,  price: 12.99 },
  { id: 'bulk',     name: 'Bulk',     credits: 600,  price: 24.99 },
  { id: 'semester', name: 'Semester', credits: 1500, price: 49.99 },
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