/**
 * Transcription: Groq first, Deepgram when Groq will not.
 *
 * Groq's whisper-large-v3-turbo is the cheapest transcription we can buy
 * ($0.04/hour) and it is what the unit economics assume. It is also capped —
 * 7,200 audio-seconds per hour and 28,800 per day, for the whole account, on
 * every plan — and it refuses files over 25 MB. Six students saving lectures
 * at ten-to-the-hour is enough to hit the hourly cap; a heavy day hits the
 * daily one. On 1 Sep one lecture was refused three times and there was
 * nothing to do but wait.
 *
 * So Groq is tried first and Deepgram (Nova-3, $0.26/hour, 2 GB files, no
 * audio caps) takes over the moment Groq fails for any reason. Any reason, on
 * purpose: a quota refusal, a 5xx, a timeout, an oversized segment and a
 * malformed response all end the same way for the student, and Deepgram is
 * there to make that ending a transcript. The fallback only bills when Groq
 * did not deliver, so the modelled cost holds for the normal path.
 *
 * Without DEEPGRAM_API_KEY the behaviour is exactly what it was: Groq or
 * nothing, with Groq's error surfaced so the client can classify it.
 */

export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions';
export const GROQ_MODEL = 'whisper-large-v3-turbo';
export const GROQ_MAX_BYTES = 24 * 1024 * 1024;
const GROQ_TIMEOUT_MS = 240_000; // generous for a full-length segment

export const DEEPGRAM_ENDPOINT = 'https://api.deepgram.com/v1/listen';
export const DEEPGRAM_MODEL = 'nova-3';
const DEEPGRAM_TIMEOUT_MS = 300_000; // Nova runs faster than real time; 5 min covers a 90-minute file with headroom

/** Sniff the container so the provider does not have to guess. */
export function audioContentType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return 'application/octet-stream';
  if (buffer.readUInt32BE(0) === 0x1a45dfa3) return 'audio/webm';          // EBML: WebM / Matroska (Chrome, Firefox)
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') return 'audio/mp4'; // MP4 / M4A (Safari, iOS)
  if (buffer.subarray(0, 4).toString('ascii') === 'OggS') return 'audio/ogg';
  if (buffer.subarray(0, 3).toString('ascii') === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  return 'application/octet-stream';
}

export async function transcribeViaGroq(buffer, apiKey) {
  if (buffer.length > GROQ_MAX_BYTES) {
    throw new Error(`Groq 413: file is ${(buffer.length / 1048576).toFixed(1)}MB, over the Groq limit`);
  }
  const form = new FormData();
  form.append('file', new Blob([buffer]), 'lecture.webm');
  form.append('model', GROQ_MODEL);
  form.append('response_format', 'json');

  const res = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(GROQ_TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Groq ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = (data?.text || '').trim();
  if (!text) throw new Error('Groq returned an empty transcript');
  return text;
}

export async function transcribeViaDeepgram(buffer, apiKey) {
  const params = new URLSearchParams({
    model: DEEPGRAM_MODEL,
    smart_format: 'true',   // punctuation, paragraphs, numbers as digits
    paragraphs: 'true',
    detect_language: 'true',
  });
  const res = await fetch(`${DEEPGRAM_ENDPOINT}?${params}`, {
    method: 'POST',
    headers: { Authorization: `Token ${apiKey}`, 'Content-Type': audioContentType(buffer) },
    body: buffer,
    signal: AbortSignal.timeout(DEEPGRAM_TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Deepgram ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  const alt = data?.results?.channels?.[0]?.alternatives?.[0];
  // With paragraphs on, Deepgram returns a paragraph-broken copy of the
  // transcript alongside the flat one; prefer it, it reads like notes.
  const text = String(alt?.paragraphs?.transcript || alt?.transcript || '').trim();
  if (!text) throw new Error('Deepgram returned an empty transcript');
  return text;
}

/** The boot line: says which providers are configured, not just that one is. */
export function transcriptionStatus(env = process.env) {
  const groq = Boolean(String(env.GROQ_API_KEY || '').trim());
  const deepgram = Boolean(String(env.DEEPGRAM_API_KEY || '').trim());
  if (!groq && !deepgram) return { ok: false, message: 'transcription: no provider configured — GROQ_API_KEY (primary) and DEEPGRAM_API_KEY (fallback) are both unset; every lecture will fail' };
  if (!groq) return { ok: true, message: 'transcription: GROQ_API_KEY unset — Deepgram will take every lecture at ~6x the modelled cost' };
  if (!deepgram) return { ok: true, message: 'transcription: groq only — DEEPGRAM_API_KEY unset, so a Groq quota refusal fails the lecture instead of falling back' };
  return { ok: true, message: 'transcription: groq primary, deepgram fallback' };
}

export function logTranscriptionStatus(env = process.env, logger = console) {
  const s = transcriptionStatus(env);
  if (s.ok) logger.log(`[boot] ${s.message}`);
  else logger.error(`[boot] ${s.message}`);
  return s;
}

/**
 * Transcribe every segment in order and stitch them. A multi-part recording
 * gets a marker between parts so the analysis can see where recording was
 * paused rather than reading a hard jump as one thought. Returns the provider
 * that actually produced the text so usage is billed against the right rate.
 */
export async function transcribeAudioParts(buffers, { env = process.env, logger = console, groq = transcribeViaGroq, deepgram = transcribeViaDeepgram } = {}) {
  const groqKey = String(env.GROQ_API_KEY || '').trim();
  const deepgramKey = String(env.DEEPGRAM_API_KEY || '').trim();
  if (!groqKey && !deepgramKey) throw new Error('No transcription provider is configured (GROQ_API_KEY or DEEPGRAM_API_KEY).');

  const total = buffers.reduce((n, b) => n + b.length, 0);
  const texts = [];
  const providers = new Set();

  for (let i = 0; i < buffers.length; i += 1) {
    const buffer = buffers[i];
    let groqError = null;
    if (groqKey) {
      try {
        logger.log('[transcribe] segment', i + 1, 'of', buffers.length, '→ groq,', buffer.length, 'bytes');
        texts.push(await groq(buffer, groqKey));
        providers.add('groq');
        continue;
      } catch (error) {
        groqError = error;
        if (!deepgramKey) throw error;
        logger.warn(`[transcribe] groq failed (${String(error?.message || error).slice(0, 160)}); falling back to deepgram`);
      }
    }
    try {
      logger.log('[transcribe] segment', i + 1, 'of', buffers.length, '→ deepgram,', buffer.length, 'bytes');
      texts.push(await deepgram(buffer, deepgramKey));
      providers.add('deepgram');
    } catch (error) {
      // Both refused. Lead with Groq's message: it is the one the client
      // classifies (quota → "process later"), and it names the real cause.
      const both = groqError ? `${groqError.message}; fallback also failed: ${error.message}` : error.message;
      throw new Error(both);
    }
  }

  const combined = buffers.length > 1
    ? texts.map((t, i) => `[Recording segment ${i + 1} of ${buffers.length}]\n${t}`).join('\n\n')
    : (texts[0] || '');
  const provider = providers.size > 1 ? 'mixed' : [...providers][0];
  logger.log(`[transcribe] ${provider} ok, ${buffers.length} segment(s), ${total} bytes → ${combined.length} chars`);
  return { text: combined, provider };
}
