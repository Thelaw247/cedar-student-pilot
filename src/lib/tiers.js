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
    blurb: 'See exactly what Praelecta does — 2 full lectures on us.',
    monthly: 0,
    semester: 0,
    creditsPerMonth: 20,
    lifetimeOnly: true, // free credits are a one-off grant, not a monthly refresh
    includes: [
      '2 recorded lectures — full transcript, summary & flashcards',
      'Unlimited typed-note lectures',
      'Full exam coverage map',
      'Calendar, planner, focus mode & analytics',
      'Timetable import',
    ],
    excludes: [
      'AI reviews, quizzes & practice questions',
      'Class handbooks & exam topic prediction',
      'AI study schedules',
    ],
  },
  student: {
    id: 'student',
    name: 'Student',
    blurb: 'The everyday study kit.',
    monthly: 7.99,
    semester: 24.99,
    creditsPerMonth: 200,
    includes: [
      'Everything in Free',
      '~20 recorded lectures a month',
      'AI reviews, quick quizzes & practice questions',
      'Missed-lecture catch-up summaries',
      'Cleaned "Professor\'s Voice" transcripts',
      'Smart rebooking & project roadmaps',
    ],
    excludes: ['Class handbooks', 'Exam topic prediction', 'AI study schedules'],
  },
  scholar: {
    id: 'scholar',
    name: 'Scholar',
    blurb: 'Everything unlocked.',
    monthly: 12.99,
    semester: 39.99,
    creditsPerMonth: 450,
    everything: true,
    includes: [
      'Everything in Student',
      '~45 recorded lectures a month',
      'Class handbooks for every course',
      'Exam topic prediction',
      'AI study schedules',
      'Full proficiency history',
    ],
  },
  unlimited: {
    id: 'unlimited',
    name: 'Unlimited',
    blurb: 'Record everything, every day.',
    monthly: 24.99,
    semester: 79.99,
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
 * What each action costs in credits. MUST stay in sync with
 * base44/shared/credits.ts — that file is the enforcing copy; this one is for
 * display only. The server is always the authority.
 */
export const CREDIT_COSTS = {
  perThirtyMinutes: { process_lecture: 5, clean_transcript: 3 },
  flat: {
    handbook: 5,
    lecture_review: 3,
    missed_summary: 2,
    project_roadmap: 2,
    study_material: 1,
    exam_prediction: 2,
    study_schedule: 1,
    smart_rebook: 1,
    session_review: 1,
    timetable_import: 0,
  },
};

/** ~1 lecture, for translating credits into something a student understands. */
export const CREDITS_PER_LECTURE = 10;

/**
 * Feature -> minimum tier (Design Blueprint follow-up + MON-04 rework,
 * Aug 2026). The HOOK stays free — recording, transcription, summaries and
 * flashcards are the aha moment and are never gated (research: gate added
 * value, never core functionality). Student buys the everyday study tools;
 * Scholar unlocks everything; Unlimited is Scholar with volume.
 *
 * MUST stay in sync with FEATURE_MIN_TIER in server/lib/credits.js — that
 * copy enforces; this one only renders locks.
 */
export const FEATURES = {
  // Free — the hook
  process_lecture:  { label: 'Record, transcribe & summarize', minTier: 'free' },
  flashcards:       { label: 'Flashcards from every lecture', minTier: 'free' },
  timetable_import: { label: 'Timetable import', minTier: 'free' },
  // Student — the everyday study kit
  lecture_review:   { label: 'AI reviews & quick quizzes', minTier: 'student' },
  study_material:   { label: 'Practice question generation', minTier: 'student' },
  session_review:   { label: 'Study session reviews', minTier: 'student' },
  missed_summary:   { label: 'Missed-lecture catch-up', minTier: 'student' },
  smart_rebook:     { label: 'Smart session rebooking', minTier: 'student' },
  project_roadmap:  { label: 'Project roadmaps', minTier: 'student' },
  clean_transcript: { label: 'Transcript cleanup', minTier: 'student' },
  // Scholar — the intelligence layer (everything unlocked)
  handbook:         { label: 'Class handbooks', minTier: 'scholar' },
  exam_prediction:  { label: 'Exam topic prediction', minTier: 'scholar' },
  study_schedule:   { label: 'AI study schedules', minTier: 'scholar' },
};

/**
 * The plan-comparison matrix for the FULL /subscription page only — the
 * compact surfaces (UpgradeSheet, onboarding paywall) keep short lists to
 * stay scannable. Every card on the page renders this SAME list so tiers
 * line up row for row, with unavailable rows struck through. Deliberately
 * short and balanced (3 rows a tier, 2 for Unlimited): a consistent value
 * step between tiers, only the headline features. Labels are marketing
 * copy; the enforcing map is FEATURES above / server credits.js.
 */
export const PLAN_FEATURES = [
  // Free — the hook (3)
  { label: 'Record, transcribe & summarize lectures', minTier: 'free' },
  { label: 'Flashcards from every lecture', minTier: 'free' },
  { label: 'Calendar, planner & exam coverage map', minTier: 'free' },
  // Student — the everyday study kit (3)
  { label: 'AI lecture reviews & quick quizzes', minTier: 'student' },
  { label: 'Practice questions & catch-up summaries', minTier: 'student' },
  { label: 'Smart rebooking & project roadmaps', minTier: 'student' },
  // Scholar — everything unlocked (3)
  { label: 'Class handbooks for every course', minTier: 'scholar' },
  { label: 'Exam topic prediction', minTier: 'scholar' },
  { label: 'AI study schedules', minTier: 'scholar' },
  // Unlimited — volume (2)
  { label: 'Record every lecture and lab', minTier: 'unlimited' },
  { label: 'Priority processing', minTier: 'unlimited' },
];

/** Does this plan include this PLAN_FEATURES row? */
export const planHas = (tierId, feature) => tierRank(tierId) >= tierRank(feature.minTier);

export const tierRank = (id) => Math.max(0, TIER_ORDER.indexOf(id || 'free'));

/** Can this tier use this feature? Unknown features are never locked. */
export const hasFeature = (tier, featureId) => {
  const f = FEATURES[featureId];
  if (!f) return true;
  return tierRank(tier) >= tierRank(f.minTier);
};

/** Display name of the cheapest tier that unlocks a feature. */
export const featureMinTierName = (featureId) =>
  TIERS[FEATURES[featureId]?.minTier || 'student'].name;

export const tierOf = (id) => TIERS[id] || TIERS.free;
export const nextTierUp = (id) => {
  const i = TIER_ORDER.indexOf(id);
  return i >= 0 && i < TIER_ORDER.length - 1 ? TIERS[TIER_ORDER[i + 1]] : null;
};

/** Friendly copy for a 402 from the server. */
export function limitMessage(feature, required, balance) {
  return `This needs ${required} credits and you have ${balance}. Top up or upgrade to keep going — your work is saved either way.`;
}