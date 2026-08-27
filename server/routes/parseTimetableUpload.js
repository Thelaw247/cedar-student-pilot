import express from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { gateFeature, settleFeature } from '../lib/credits.js';
import { parseTimetableDataUrl } from '../lib/timetableFile.js';
import { consolidateTimetableClasses } from '../lib/timetableResult.js';

// Direct port of base44/functions/parseTimetableUpload/entry.ts, with ONE
// real change: the original never routed through llm.ts because Base44's
// fallback provider was text-only, so this was the one call that stayed on
// Base44's vision-capable Core.InvokeLLM. That fallback doesn't exist on this
// stack. Gemini's own API supports inline image input directly, so this
// calls it that way — completing the original intent rather than porting a
// limitation that only existed because of the old abstraction.
//
// Deliberately still gateFeature'd at cost 0, same as the original: this
// runs during onboarding and must never be blocked, but still needs to show
// up in usage_events so its real cost is visible in the margin numbers.

const router = express.Router();

const SCHEMA = {
  type: 'object',
  properties: {
    classes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          course_code: { type: 'string' },
          name: { type: 'string' },
          section: { type: 'string' },
          component: { type: 'string' },
          instructor: { type: 'string' },
          room: { type: 'string' },
          days_of_week: { type: 'array', items: { type: 'string' } },
          start_time: { type: 'string' },
          end_time: { type: 'string' },
          start_date: { type: 'string' },
          end_date: { type: 'string' },
          specific_dates: { type: 'array', items: { type: 'string' } },
          replaces_regular_time: { type: 'boolean' },
        },
        required: ['course_code', 'name', 'section', 'component', 'instructor', 'room', 'days_of_week', 'start_time', 'end_time', 'start_date', 'end_date', 'specific_dates', 'replaces_regular_time'],
      },
    },
  },
};

function toGeminiSchema(node) {
  if (node === null || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map(toGeminiSchema);
  const out = {};
  for (const [k, v] of Object.entries(node)) out[k] = (k === 'type' && typeof v === 'string') ? v.toUpperCase() : toGeminiSchema(v);
  return out;
}

const PROMPT = `You are an expert at reading university class timetables. Analyze the provided timetable image or document and extract ALL classes/courses shown.

For each class, extract:
- course_code: The stable catalog code, such as "CHEM 112" or "ENGR 120". Use an empty string only when none is visible.
- name: The course name (e.g. "Introduction to Biology")
- section: The section identifier if shown
- component: Lecture, Lab, Tutorial, Seminar, Practicum, or another printed component label
- instructor: The professor/instructor name if available
- room: The classroom or location if available
- days_of_week: Array of days the class meets (use abbreviations: Mon, Tue, Wed, Thu, Fri, Sat, Sun)
- start_time: Start time in 24-hour HH:MM format
- end_time: End time in 24-hour HH:MM format
- start_date: First date this exact schedule pattern applies, in YYYY-MM-DD format
- end_date: Last date this exact schedule pattern applies, in YYYY-MM-DD format
- specific_dates: Exact YYYY-MM-DD dates when this is a one-off or irregular meeting; otherwise []
- replaces_regular_time: true only when a specific-date entry replaces that component's normal meeting on that date; false when it is additional

Return a JSON object with a "classes" array containing all extracted classes. If you cannot read the timetable or it's unclear, return an empty array.

Be thorough — capture every class on the timetable. If days aren't explicitly listed but the class appears to recur, infer standard weekday patterns.

Repeated rows with the same course code or course name are normally schedule patterns for ONE logical course, not separate courses. Preserve the same course_code and name on those rows so they can be consolidated. Return a separate entry for every distinct time, room, component, date range, or explicit-date pattern; the server will merge those entries safely.

Dates are per schedule pattern, not global. Read the exact range or dates printed beside that pattern. Return empty strings/arrays when dates are not visible; never invent a date and never use the timetable's print/generated date.`;

router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { file_url } = req.body || {};
    if (!file_url) return res.status(400).json({ error: 'file_url is required' });

    const gate = await gateFeature(userId, 'timetable_import', res);
    if (!gate.ok) return; // gateFeature already sent the 402

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      console.error('[parse-timetable-upload] Gemini is not configured');
      return res.status(503).json({
        code: 'GEMINI_NOT_CONFIGURED',
        error: 'Timetable analysis is not configured yet',
      });
    }

    // The browser sends the selected file inline. Never fetch a caller-supplied
    // URL here: doing so would turn this authenticated endpoint into an SSRF
    // primitive against Render's internal network and cloud metadata services.
    const { mimeType, buffer } = parseTimetableDataUrl(file_url);
    const base64 = buffer.toString('base64');

    const body = {
      contents: [{ role: 'user', parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: toGeminiSchema(SCHEMA) },
    };

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
      // Same guard as every other provider call: Node's fetch never times
      // out on its own, and a timetable image is a large multimodal request.
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(120_000) },
    );
    if (!geminiRes.ok) {
      const detail = await geminiRes.text().catch(() => '');
      const providerError = new Error(`Gemini ${geminiRes.status}: ${detail.slice(0, 300)}`);
      providerError.code = 'GEMINI_REQUEST_FAILED';
      providerError.providerStatus = geminiRes.status;
      throw providerError;
    }
    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const result = text ? JSON.parse(text) : { classes: [] };
    const classes = consolidateTimetableClasses(result.classes);

    await settleFeature(gate, { feature: 'timetable_import', calls: 1, usedGemini: true });

    res.json({ classes });
  } catch (error) {
    if (error instanceof TypeError) return res.status(400).json({ error: error.message });
    if (error instanceof RangeError) return res.status(413).json({ error: error.message });
    console.error('[parse-timetable-upload] failed', {
      code: error.code || 'TIMETABLE_PARSE_FAILED',
      providerStatus: error.providerStatus || null,
      message: error.message,
    });
    if (error.code === 'GEMINI_REQUEST_FAILED') {
      return res.status(502).json({
        code: error.code,
        error: error.providerStatus === 429
          ? 'Timetable analysis is temporarily rate-limited. Please try again shortly.'
          : 'The timetable analysis provider rejected the request. Please try another file or try again shortly.',
      });
    }
    res.status(500).json({ code: 'TIMETABLE_PARSE_FAILED', error: 'Could not parse the timetable' });
  }
});

export default router;
