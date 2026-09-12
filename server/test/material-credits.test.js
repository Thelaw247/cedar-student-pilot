import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FEATURE_COSTS, FEATURE_MIN_TIER, tierAllows } from '../lib/credits.js';

/**
 * Reading a professor's PDF is one Gemini OCR call — the app's second-largest
 * cost centre after recording (17 reads, ~$0.30, avg $0.018 each in the first
 * weeks) — and it was uncharged and ungated. This pins the fix: a PDF costs one
 * credit and needs Student; a plain-text or Markdown note stays free of credits
 * but is held to the same tier; and the credit is charged only AFTER a
 * successful read, never on a refusal or a failed extraction.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const ROUTE = read('../routes/lectureMaterials.js');
const CREDITS = read('../lib/credits.js');

test('material_extract is a Student feature that costs one credit', () => {
  assert.equal(FEATURE_COSTS.material_extract, 1);
  assert.equal(FEATURE_MIN_TIER.material_extract, 'student');
  assert.equal(tierAllows('free', 'material_extract'), false, 'free tier must not read materials');
  assert.equal(tierAllows('student', 'material_extract'), true);
  assert.equal(tierAllows('scholar', 'material_extract'), true);
  assert.equal(tierAllows('unlimited', 'material_extract'), true);
});

test('gateFeature is built on requireTier, so the tier rule has one source', () => {
  // requireTier is the tier-only half. A file that is free for the qualifying
  // tier (text/markdown) enforces the SAME minimum through it without demanding
  // a credit, and gateFeature layers the credit check on top — one rule, two
  // callers, no drift.
  assert.match(CREDITS, /export async function requireTier\(/);
  assert.match(CREDITS, /const tier = await requireTier\(userId, feature, res, extra\);/);
});

test('only a PDF is billed; text and markdown are gated but free', () => {
  assert.match(ROUTE, /function isPdfMaterial\(/);
  const gate = ROUTE.slice(ROUTE.indexOf('async function gateMaterial'), ROUTE.indexOf("router.post('/upload-url'"));
  assert.match(gate, /if \(isPdfMaterial\(contentType\)\)[\s\S]*gateFeature\(userId, 'material_extract'/,
    'a PDF must go through gateFeature (tier + credit)');
  assert.match(gate, /requireTier\(userId, 'material_extract'[\s\S]*return \{ ok: tier\.ok, gate: null \}/,
    'text/markdown must go through requireTier (tier only, nothing to settle)');
});

test('both endpoints gate before doing any work', () => {
  // /upload-url gates before the presign so a refused upload never orphans an
  // object in storage.
  const uploadUrl = ROUTE.slice(ROUTE.indexOf("router.post('/upload-url'"), ROUTE.indexOf("router.post('/confirm'"));
  assert.match(uploadUrl, /gateMaterial\([\s\S]*if \(!gate\.ok\) return;[\s\S]*createMaterialUpload/,
    'upload-url must gate before handing out a presigned URL');
  // /confirm re-gates so a direct call cannot skip it, and gates before reading.
  const confirm = ROUTE.slice(ROUTE.indexOf("router.post('/confirm'"));
  const gateAt = confirm.indexOf('gateMaterial(');
  const workAt = confirm.indexOf('confirmMaterialUpload(');
  assert.ok(gateAt > 0 && gateAt < workAt, 'confirm must gate before reading the file');
});

test('the credit is charged only after the row is saved, and only on a real read', () => {
  const confirm = ROUTE.slice(ROUTE.indexOf("router.post('/confirm'"));
  const insertAt = confirm.indexOf('insert into lecture_materials');
  const settleAt = confirm.indexOf('settleFeature(');
  assert.ok(insertAt > 0 && settleAt > insertAt, 'settle must come after the material row is inserted (charge-after-success)');
  // Guarded by a successful extraction AND an actual model call — a failed or
  // empty PDF read charges nothing.
  assert.match(confirm, /if \(gate\.gate && extracted && llmUsage\.geminiCalls > 0\)[\s\S]*settleFeature\(gate\.gate/);
});
