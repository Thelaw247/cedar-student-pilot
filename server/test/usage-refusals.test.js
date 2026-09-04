import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FEATURE_MIN_TIER } from '../lib/credits.js';

/**
 * The owner dashboard told a lie that mattered.
 *
 * gateFeature logs success=false both when something genuinely broke and when
 * we deliberately declined — the student's tier does not include the feature,
 * or their balance does not cover it. The dashboard counted both as failures,
 * so on 4 Sep a new user's first day read as "5 of 12 failed" when all five
 * were the paywall working exactly as intended: three two-hour lectures she
 * could not afford on free, and two Student-only features. She upgraded and
 * completed every one of them within minutes.
 *
 * Worse than the false alarm: a real failure would have been invisible in the
 * noise. Across the whole ledger at the time of this fix, every single
 * success=false row was a gate refusal and none was a fault.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const CREDITS = read('../lib/credits.js');
const ANALYTICS = read('../routes/ownerAnalytics.js');
const DASHBOARD = read('../../src/pages/OwnerAnalytics.jsx');
const MIGRATION = read('../../supabase/migrations/20260904000000_usage_event_refusals.sql');

test('the ledger records why a request was declined', () => {
  assert.match(CREDITS, /audio_seconds, refusal\)/, 'refusal is not persisted');
  assert.match(CREDITS, /event\.refusal \|\| null/);
  // The two gates inside gateFeature say which one they are.
  assert.match(CREDITS, /success: false, refusal: 'tier'/);
  assert.match(CREDITS, /success: false, refusal: 'credits'/);
});

test('every gate in the codebase marks itself, and only genuine failures do not', () => {
  // A new gate that forgets the flag silently becomes a "failure" on the
  // dashboard, which is the bug this whole change exists to remove.
  const routes = fs.readdirSync(new URL('../routes', import.meta.url));
  const unmarked = [];
  for (const file of routes) {
    if (!file.endsWith('.js')) continue;
    const src = read(`../routes/${file}`);
    for (const line of src.split('\n')) {
      if (!line.includes('success: false')) continue;
      if (line.includes('refusal')) continue;
      unmarked.push(`${file}: ${line.trim().slice(0, 80)}`);
    }
  }
  // cleanLectureTranscript's 502 is the one real failure site: it only fires
  // after the model has run and produced nothing, and it records a provider.
  assert.equal(unmarked.length, 1, `unexpected unmarked success:false sites:\n${unmarked.join('\n')}`);
  assert.match(unmarked[0], /cleanLectureTranscript/);
});

test('the dashboard separates paywall stops from faults', () => {
  assert.match(ANALYTICS, /if \(e\.refusal\) u\.refusals \+= 1;/);
  assert.match(ANALYTICS, /else u\.failures \+= 1;/);
  assert.match(ANALYTICS, /refusals: usage\.refusals/);
  assert.match(DASHBOARD, /c\.refusals > 0/);
  assert.match(DASHBOARD, /paywall/i);
  // Only a real failure keeps the warning colour.
  assert.match(DASHBOARD, /\{c\.failures > 0 && <span className="ml-1 text-xs text-amber-600">/);
});

test('the backfill classifies old rows the same way the code now does', () => {
  // The migration decides tier-vs-credits from the feature's minimum tier, so
  // it has to agree with FEATURE_MIN_TIER or history is mislabelled.
  const studentFeatures = Object.entries(FEATURE_MIN_TIER).filter(([, t]) => t === 'student').map(([f]) => f);
  const scholarFeatures = Object.entries(FEATURE_MIN_TIER).filter(([, t]) => t === 'scholar').map(([f]) => f);
  for (const f of studentFeatures) assert.ok(MIGRATION.includes(`'${f}'`), `${f} missing from the backfill`);
  for (const f of scholarFeatures) assert.ok(MIGRATION.includes(`'${f}'`), `${f} missing from the backfill`);
  // Additive and reversible in meaning: nothing is deleted, nothing overwritten.
  assert.match(MIGRATION, /add column if not exists refusal text/);
  assert.match(MIGRATION, /where success = false\s*\n\s*and refusal is null/);
  assert.doesNotMatch(MIGRATION, /\bdelete\b/i);
  assert.doesNotMatch(MIGRATION, /drop column/i);
});
