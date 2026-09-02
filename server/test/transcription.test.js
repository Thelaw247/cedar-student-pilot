import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  transcribeAudioParts, transcriptionStatus, audioContentType, transcribeViaDeepgram, GROQ_MAX_BYTES,
} from '../lib/transcription.js';

/**
 * Groq is capped at 8 hours of audio a day for the whole account; on 1 Sep a
 * single lecture was refused three times with nowhere to go. Deepgram now
 * takes over whenever Groq does not deliver — and only then, so the modelled
 * Groq cost still holds for the normal path.
 */
const quiet = { log() {}, warn() {}, error() {} };
const env = { GROQ_API_KEY: 'g', DEEPGRAM_API_KEY: 'd' };
const groqQuota = async () => { throw new Error('Groq 413: {"error":{"message":"Request too large ... seconds of audio per hour (ASPH): Limit 7200"}}'); };

test('Groq is used when it works, and Deepgram is never called', async () => {
  let deepgramCalls = 0;
  const r = await transcribeAudioParts([Buffer.from('a')], { env, logger: quiet, groq: async () => 'hello', deepgram: async () => { deepgramCalls += 1; return 'x'; } });
  assert.deepEqual(r, { text: 'hello', provider: 'groq' });
  assert.equal(deepgramCalls, 0);
});

test('a Groq quota refusal falls back to Deepgram and bills as deepgram', async () => {
  const r = await transcribeAudioParts([Buffer.from('a')], { env, logger: quiet, groq: groqQuota, deepgram: async () => 'from deepgram' });
  assert.deepEqual(r, { text: 'from deepgram', provider: 'deepgram' });
});

test('a segment over the Groq size limit goes to Deepgram without an HTTP call', async () => {
  const big = Buffer.alloc(GROQ_MAX_BYTES + 1);
  let fetched = false;
  const original = globalThis.fetch; globalThis.fetch = async () => { fetched = true; throw new Error('should not fetch'); };
  try {
    const r = await transcribeAudioParts([big], { env, logger: quiet, deepgram: async () => 'ok' });
    assert.equal(r.provider, 'deepgram');
    assert.equal(fetched, false, 'Groq must be skipped by the size check, not by a failed upload');
  } finally { globalThis.fetch = original; }
});

test('without a Deepgram key the Groq error is surfaced unchanged, so the client can classify it', async () => {
  await assert.rejects(
    () => transcribeAudioParts([Buffer.from('a')], { env: { GROQ_API_KEY: 'g' }, logger: quiet, groq: groqQuota }),
    /per hour \(ASPH\)/,
  );
});

test('when both refuse, the message leads with Groq and names the fallback failure', async () => {
  await assert.rejects(
    () => transcribeAudioParts([Buffer.from('a')], { env, logger: quiet, groq: groqQuota, deepgram: async () => { throw new Error('Deepgram 500: boom'); } }),
    /ASPH.*fallback also failed: Deepgram 500/,
  );
});

test('multi-part recordings are stitched with segment markers and a mixed provider is reported', async () => {
  let n = 0;
  const groq = async () => { n += 1; if (n === 2) throw new Error('Groq 429'); return `part${n}`; };
  const r = await transcribeAudioParts([Buffer.from('a'), Buffer.from('b')], { env, logger: quiet, groq, deepgram: async () => 'part2dg' });
  assert.match(r.text, /\[Recording segment 1 of 2\]\npart1/);
  assert.match(r.text, /\[Recording segment 2 of 2\]\npart2dg/);
  assert.equal(r.provider, 'mixed');
});

test('the container is sniffed so Safari recordings are sent as mp4, Chrome as webm', () => {
  assert.equal(audioContentType(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0])), 'audio/webm');
  assert.equal(audioContentType(Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypM4A '), Buffer.alloc(8)])), 'audio/mp4');
  assert.equal(audioContentType(Buffer.from('OggS00000000')), 'audio/ogg');
  assert.equal(audioContentType(Buffer.from('nope')), 'application/octet-stream');
});

test('Deepgram is called with Nova-3 and its paragraphed transcript is preferred', async () => {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ results: { channels: [{ alternatives: [{ transcript: 'flat text', paragraphs: { transcript: 'Para one.\n\nPara two.' } }] }] } }), { status: 200 });
  };
  try {
    const text = await transcribeViaDeepgram(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]), 'dg-key');
    assert.equal(text, 'Para one.\n\nPara two.');
    assert.match(calls[0].url, /api\.deepgram\.com\/v1\/listen\?.*model=nova-3/);
    assert.equal(calls[0].init.headers.Authorization, 'Token dg-key');
    assert.equal(calls[0].init.headers['Content-Type'], 'audio/webm');
  } finally { globalThis.fetch = original; }
});

test('the boot line says exactly which providers are configured', () => {
  assert.match(transcriptionStatus({ GROQ_API_KEY: 'g', DEEPGRAM_API_KEY: 'd' }).message, /groq primary, deepgram fallback/);
  assert.match(transcriptionStatus({ GROQ_API_KEY: 'g' }).message, /DEEPGRAM_API_KEY unset/);
  assert.equal(transcriptionStatus({}).ok, false);
});

test('the pipeline uses the shared module and bills Deepgram at its own rate', () => {
  const route = fs.readFileSync(new URL('../routes/processLectureRecording.js', import.meta.url), 'utf8');
  assert.match(route, /from '\.\.\/lib\/transcription\.js'/);
  assert.doesNotMatch(route, /api\.groq\.com/, 'the Groq endpoint must live in one place');
  const credits = fs.readFileSync(new URL('../lib/credits.js', import.meta.url), 'utf8');
  assert.match(credits, /deepgramUsdPerAudioHour/);
  assert.match(route, /transcriptionCostCad\(/);
  const index = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  assert.match(index, /logTranscriptionStatus\(\)/);
});
