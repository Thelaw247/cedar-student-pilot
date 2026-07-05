import { getSetting } from '@/lib/settings';

export const DECAY_PRESETS = {
  fast: { decayStart: 7, decayEnd: 14, label: 'Fast' },
  default: { decayStart: 14, decayEnd: 28, label: 'Default' },
  slow: { decayStart: 21, decayEnd: 42, label: 'Slow' },
};

export const DECAY_STATES = {
  fresh: { label: 'Reviewed', color: '#10B981', bgClass: 'bg-emerald-500/10', textClass: 'text-emerald-600' },
  fading: { label: 'Fading', color: '#F59E0B', bgClass: 'bg-amber-500/10', textClass: 'text-amber-600' },
  stale: { label: 'Stale', color: '#F97316', bgClass: 'bg-orange-500/10', textClass: 'text-orange-600' },
  overdue: { label: 'Overdue', color: '#EF4444', bgClass: 'bg-rose-500/10', textClass: 'text-rose-600' },
  unreviewed: { label: 'Unreviewed', color: '#9CA3AF', bgClass: 'bg-gray-500/10', textClass: 'text-gray-500' },
};

const STATE_RANKS = { fresh: 0, fading: 1, stale: 2, overdue: 3, unreviewed: 0 };

export function getDecayPreset() {
  const rate = getSetting('conceptDecayRate') || 'default';
  return DECAY_PRESETS[rate] || DECAY_PRESETS.default;
}

export function daysSinceReview(dateStr) {
  if (!dateStr) return null;
  const reviewed = new Date(dateStr + 'T00:00:00');
  if (isNaN(reviewed.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffMs = now - reviewed;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Compute recency rank for a lecture within its class.
 * @returns 0 (oldest) to 1 (newest)
 */
export function computeRecencyRank(lecture, allClassLectures) {
  if (!allClassLectures || allClassLectures.length <= 1) return 1;
  const sorted = [...allClassLectures].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const idx = sorted.findIndex(l => l.id === lecture.id);
  if (idx < 0) return 1;
  return sorted.length > 1 ? idx / (sorted.length - 1) : 1;
}

/**
 * Compute the decay state for a single lecture based on its KnowledgeCoverage.
 * Applies recency-weighted decay: older lectures decay faster.
 */
export function getDecayState(coverage, allClassLectures, lecture) {
  if (!coverage || !coverage.last_reviewed_date) {
    return { state: 'unreviewed', ...DECAY_STATES.unreviewed, daysSinceReview: null };
  }

  const days = daysSinceReview(coverage.last_reviewed_date);
  if (days === null || days < 0) {
    return { state: 'unreviewed', ...DECAY_STATES.unreviewed, daysSinceReview: null };
  }

  const preset = getDecayPreset();
  const recencyRank = computeRecencyRank(lecture, allClassLectures);
  // Older lectures (recencyRank → 0) get a compressed window (multiplier → 0.6)
  // Newest lectures (recencyRank = 1) use the full window (multiplier = 1.0)
  const multiplier = 1 - (1 - recencyRank) * 0.4;
  const effStart = preset.decayStart * multiplier;
  const effEnd = preset.decayEnd * multiplier;
  const span = effEnd - effStart;

  let stateKey;
  if (days <= effStart) stateKey = 'fresh';
  else if (days <= effStart + span / 3) stateKey = 'fading';
  else if (days <= effStart + (2 * span) / 3) stateKey = 'stale';
  else stateKey = 'overdue';

  return { state: stateKey, ...DECAY_STATES[stateKey], daysSinceReview: days };
}

/**
 * Compute class-level proficiency with decay applied.
 * Each lecture's contribution is weighted by recency rank (newest = highest weight).
 * Fully decayed classes floor at a 'needs review' state.
 */
export function computeClassProficiency(lecturesWithCoverage, allClassLectures) {
  if (!lecturesWithCoverage || lecturesWithCoverage.length === 0) {
    return { proficiency: 0, decayState: 'unreviewed', allOverdue: false, worstState: 'unreviewed' };
  }

  let totalProficiency = 0;
  let totalWeight = 0;
  let worstRank = 0;
  let allDecayed = true;

  for (const { lecture, coverage } of lecturesWithCoverage) {
    const recencyRank = computeRecencyRank(lecture, allClassLectures);
    const weight = 0.4 + recencyRank * 0.6;
    totalWeight += weight;

    const decay = getDecayState(coverage, allClassLectures, lecture);
    worstRank = Math.max(worstRank, STATE_RANKS[decay.state] || 0);

    if (decay.state !== 'overdue' && decay.state !== 'unreviewed') {
      allDecayed = false;
    }

    const seen = coverage?.concepts_seen || [];
    const mastered = coverage?.concepts_mastered || [];
    const baseProf = seen.length > 0 ? (mastered.length / seen.length) * 100 : 0;

    const decayFactors = { fresh: 1.0, fading: 0.85, stale: 0.6, overdue: 0.3, unreviewed: 0.5 };
    const effectiveProf = baseProf * (decayFactors[decay.state] || 0.5);

    totalProficiency += effectiveProf * weight;
  }

  const proficiency = totalWeight > 0 ? Math.round(totalProficiency / totalWeight) : 0;
  const stateKeys = ['fresh', 'fading', 'stale', 'overdue'];
  const worstState = stateKeys[worstRank] || 'fresh';

  return {
    proficiency: allDecayed ? Math.min(proficiency, 15) : proficiency,
    decayState: worstState,
    allOverdue: allDecayed,
    worstState,
  };
}

/**
 * Get the worst (most decayed) state across multiple lecture decay states.
 */
export function getWorstState(states) {
  let worstRank = 0;
  for (const s of states) {
    worstRank = Math.max(worstRank, STATE_RANKS[s?.state] || 0);
  }
  const keys = ['fresh', 'fading', 'stale', 'overdue'];
  return keys[worstRank] || 'fresh';
}