import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COST_PER_30MIN_CLEAN, COST_PER_30MIN_PROCESS, FEATURE_COSTS,
} from '../lib/credits.js';

// shared/tiers.js shows the student what an action will cost; server/lib/
// credits.js decides what they are actually charged. They are two hand-kept
// copies of one price list. When cleanup was repriced after the Gemini rate
// change the server moved and the client did not, which would have quoted 3
// credits and taken 4 — exactly the kind of surprise the billing rules forbid.

async function clientTable() {
  const { readFile } = await import('node:fs/promises');
  const src = await readFile(new URL('../../shared/tiers.js', import.meta.url), 'utf8');
  const per30 = src.match(/perThirtyMinutes:\s*\{([^}]*)\}/);
  assert.ok(per30, 'tiers.js must declare perThirtyMinutes');
  const costs = src.match(/export const CREDIT_COSTS[\s\S]*?\n\};/);
  const num = (block, key) => {
    const m = block.match(new RegExp(`${key}\\s*:\\s*(\\d+)`));
    return m ? Number(m[1]) : undefined;
  };
  return { per30: per30[1], all: costs ? costs[0] : src, num };
}

test('the client quotes the same per-30-minute prices the server charges', async () => {
  const { per30, num } = await clientTable();
  assert.equal(num(per30, 'process_lecture'), COST_PER_30MIN_PROCESS);
  assert.equal(num(per30, 'clean_transcript'), COST_PER_30MIN_CLEAN);
});

test('the client quotes the same per-feature prices the server charges', async () => {
  const { all, num } = await clientTable();
  for (const [feature, cost] of Object.entries(FEATURE_COSTS)) {
    const shown = num(all, feature);
    if (shown === undefined) continue; // not surfaced in the client cost table
    assert.equal(shown, cost, `${feature}: client shows ${shown}, server charges ${cost}`);
  }
});

test('cleanup costs less per credit than processing, per 30 minutes', () => {
  // Cleanup is the cheaper operation and must stay the cheaper charge, or the
  // credit stops meaning roughly "a recorded minute".
  assert.ok(COST_PER_30MIN_CLEAN < COST_PER_30MIN_PROCESS);
});
