import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * A refusal a student can act on.
 *
 * ExamPredictionCard already carried the law — "paywall is never an error" —
 * and it held everywhere the UI knew a feature was locked BEFORE the tap. It
 * did not hold on the way back. The server answers a gated call with a
 * machine-readable 402; almost every screen caught it, pulled `message` out,
 * threw the rest away, and rendered a sentence in red.
 *
 * Twelve handbook refusals were logged on one live account in a single day —
 * each one a student reading "this needs Scholar" with nothing to press.
 */

const read = (rel) => fs.readFileSync(new URL(rel, import.meta.url), 'utf8');
const NOTICE = read('../../src/components/monetization/GateNotice.jsx');
const CREDITS = read('../../server/lib/credits.js');

// Every client call to a tier-gated feature. The features come from
// FEATURE_MIN_TIER; the files are where the browser calls them.
const GATED_CALLERS = [
  ['StudyToolbox',           '../../src/components/StudyToolbox.jsx'],
  ['HandbookReader',         '../../src/components/HandbookReader.jsx'],
  ['ManualStudyGuide',       '../../src/components/ManualStudyGuide.jsx'],
  ['InLectureQuiz',          '../../src/components/InLectureQuiz.jsx'],
  ['SessionReview',          '../../src/components/SessionReview.jsx'],
  ['RebookSessionModal',     '../../src/components/RebookSessionModal.jsx'],
  ['ProjectAssignmentModal', '../../src/components/ProjectAssignmentModal.jsx'],
  ['ClassDetail',            '../../src/pages/ClassDetail.jsx'],
];

test('the server still answers a refusal in a shape the UI can act on', () => {
  // If these strings move, gateFromError goes blind and every notice below
  // silently degrades to the generic error it replaced.
  assert.match(CREDITS, /error: 'upgrade_required'/);
  assert.match(CREDITS, /required_tier: requiredTier/);
  assert.match(CREDITS, /error: 'insufficient_credits'/);
  assert.match(NOTICE, /data\.error === 'upgrade_required'/);
  assert.match(NOTICE, /data\.error === 'insufficient_credits'/);
  assert.match(NOTICE, /status !== 402/, 'a non-402 must not be read as a refusal');
});

test('the two refusals stay two things', () => {
  // A tier refusal is only fixed by upgrading; a credits refusal is fixed by a
  // pack too. Flattening them produces a button that lies to one of them.
  assert.match(NOTICE, /kind: 'tier'/);
  assert.match(NOTICE, /kind: 'credits'/);
  assert.match(NOTICE, /Unlocks with \$\{gate\.requiredTierName\}/);
  assert.match(NOTICE, /Get more credits/);
});

test('the notice offers exactly one control, and it opens the paywall', () => {
  assert.match(NOTICE, /openUpgrade\(\{ source, feature: gate\.feature \}\)/);
  assert.match(NOTICE, /Upgrade to unlock/);
});

test('every gated caller keeps the refusal instead of flattening it', () => {
  for (const [name, rel] of GATED_CALLERS) {
    const src = read(rel);
    assert.match(src, /gateFromError\(/, `${name} still discards the 402's shape`);
    assert.match(src, /<GateNotice/, `${name} reads the refusal but renders nothing to press`);
  }
});

test('no gated caller answers a refusal with an alert', () => {
  // alert() cannot hold a button, so a refusal that reaches one is a dead end
  // by construction — which is what ProjectAssignmentModal and the missed
  // lecture summary both were.
  for (const [name, rel] of GATED_CALLERS) {
    const src = read(rel);
    const catches = [...src.matchAll(/catch \(e\) \{([\s\S]{0,320}?)\n\s*\}/g)].map((m) => m[1]);
    for (const body of catches) {
      if (!/gateFromError/.test(body)) continue;
      assert.doesNotMatch(body, /\balert\(/,
        `${name} still alerts on a path that can carry a refusal`);
    }
  }
});

test('the lock a student sees before the tap is unchanged', () => {
  // The pre-tap treatment already worked. This change is about the way back,
  // and must not disturb useFeatureGate's contract.
  const gate = read('../../src/components/monetization/useFeatureGate.js');
  assert.match(gate, /openUpgrade\(\{ source: 'feature-lock', feature: featureId \}\)/);
  assert.match(gate, /const allowed = hasFeature\(tier, featureId\)/);
});
