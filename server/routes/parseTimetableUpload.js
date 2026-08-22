import express from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { gateFeature, settleFeature } from '../lib/credits.js';
import { parseTimetableDataUrl } from '../lib/timetableFile.js';

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
          name: { type: 'string' },
          instructor: { type: 'string' },
          room: { type: 'string' },
          days_of_week: { type: 'array', items: { type: 'string' } },
          start_time: { type: 'string' },
          end_time: { type: 'string' },
        },
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
- name: The course name (e.g. "Introduction to Biology")
- instructor: The professor/instructor name if available
- room: The classroom or location if available
- days_of_week: Array of days the class meets (use abbreviations: Mon, Tue, Wed, Thu, Fri, Sat, Sun)
- start_time: Start time in 24-hour HH:MM format
- end_time: End time in 24-hour HH:MM format

Return a JSON object with a "classes" array containing all extracted classes. If you cannot read the timetable or it's unclear, return an empty array.

Be thorough — capture every class on the timetable. If days aren't explicitly listed but the class appears to recur, infer standard weekday patterns.`;

router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { file_url } = req.body || {};
    if (!file_url) return res.status(400).json({ error: 'file_url is required' });

    const gate = await gateFeature(userId, 'timetable_import', res);
    if (!gate.ok) return; // gateFeature already sent the 402

    const key = process.env.GEMINI_API_KEY;
    if (!key) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

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
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
    );
    if (!geminiRes.ok) {
      const detail = await geminiRes.text().catch(() => '');
      throw new Error(`Gemini ${geminiRes.status}: ${detail.slice(0, 300)}`);
    }
    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const result = text ? JSON.parse(text) : { classes: [] };

    await settleFeature(gate, { feature: 'timetable_import', calls: 1, usedGemini: true });

    res.json({ classes: result.classes || [] });
  } catch (error) {
    if (error instanceof TypeError) return res.status(400).json({ error: error.message });
    if (error instanceof RangeError) return res.status(413).json({ error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
