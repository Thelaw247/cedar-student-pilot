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
    semester: 31.99,
    creditsPerMonth: 200,
    includes: [
      'Everything in Free',
      '~20 recorded lectures a month',
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
    creditsPerMonth: 450,
    includes: [
      'Everything in Student',
      '~45 recorded lectures a month',
      'Handbooks for every class',
      'Full proficiency history',
    ],
  },
  unlimited: {
    id: 'unlimited',
    name: 'Unlimited',
    blurb: 'Record everything, every day.',
    monthly: 29.99,
    semester: 95.99,
    creditsPerMonth: 1000,
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

/** One-off credit packs — for topping up mid-period without changing plan.
 *
 *  DELIBERATELY dearer per credit than every subscription tier ($0.056-$0.070
 *  against $0.030-$0.050). Packs never expire and need no commitment, and
 *  that convenience is what the premium buys. If a pack is ever cheaper per
 *  credit than a subscription, nobody subscribes and recurring revenue dies —
 *  which is exactly what the previous catalogue did.
 *
 *  `id` is what the client sends; the server maps it to a Stripe price. */
export const CREDIT_PACKS = [
  { id: 'small',  name: 'Small',  credits: 100, price: 6.99 },
  { id: 'medium', name: 'Medium', credits: 250, price: 14.99 },
  { id: 'large',  name: 'Large',  credits: 500, price: 27.99 },
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