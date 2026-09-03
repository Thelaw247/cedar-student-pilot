import { invokeLLM, QUALITY_MODEL } from './llm.js';

// The second analysis pass over a lecture (3 Sep 2026).
//
// The first pass (processLectureRecording → extractFromTranscript) produces
// the flat lists every screen already reads: title, summary, concepts,
// vocabulary, definitions, formulas, action items, exam mentions. It runs on
// 15k-character chunks and merges by string, which is exactly why it loses
// so much of a lecture: no structure, no examples, nothing that says WHERE
// in the recording a thing was said, and a formula the transcription
// mangled is stored as heard.
//
// This pass reads the whole transcript in one call (the quality model has
// the context for it), together with whatever the professor handed out
// (lecture_materials.extracted_text), and produces `ai_enrichment`:
//
//   outline        the lecture as sections, each with key points and an
//                  anchor — a short verbatim quote resolved here to a
//                  character offset in the transcript, so the UI can jump
//                  to the exact moment
//   concepts       one card per concept: what it is, why it matters, how
//                  hard it is, related concepts, an anchor, and a search
//                  query the UI turns into web resources
//   formulas       expression + LaTeX + meaning + every variable named and
//                  unit-ed, when to use it, an anchor, and `verified` —
//                  true ONLY when the expression is also found in a
//                  material the student attached (checked here, not by the
//                  model)
//   definitions    same verification rule
//   examples       worked examples the professor walked through
//   exam_radar     everything said about assessment, with importance
//   misconceptions "students often get this wrong" notes
//   questions      things worth asking the professor / TA
//   todos          the tasks the professor actually assigned, typed
//
// Anchors and verification are what make this trustworthy: the model may
// claim a quote or a match; the code checks both against the real text and
// downgrades anything it cannot find. Everything the UI shows as "verified"
// or "in transcript" has passed that check.

export const ENRICHMENT_VERSION = 1;
const MAX_TRANSCRIPT_CHARS = 200_000;
const MAX_MATERIALS_CHARS = 140_000;
const MAX_ITEMS = { outline: 24, concepts: 24, formulas: 24, definitions: 30, examples: 12, exam_radar: 16, misconceptions: 10, questions: 8, todos: 12, key_takeaways: 10 };

const anchorSchema = { type: 'string', description: 'A short verbatim quote (6-14 words) copied exactly from the transcript where this appears' };

export const ENRICHMENT_SCHEMA = {
  type: 'object',
  properties: {
    one_liner: { type: 'string' },
    key_takeaways: { type: 'array', items: { type: 'string' } },
    outline: { type: 'array', items: { type: 'object', properties: {
      heading: { type: 'string' }, summary: { type: 'string' },
      key_points: { type: 'array', items: { type: 'string' } }, anchor: anchorSchema,
    }, required: ['heading', 'summary'] } },
    concepts: { type: 'array', items: { type: 'object', properties: {
      name: { type: 'string' }, explanation: { type: 'string' }, why_it_matters: { type: 'string' },
      difficulty: { type: 'string', enum: ['core', 'supporting', 'advanced'] },
      related: { type: 'array', items: { type: 'string' } },
      search_query: { type: 'string' }, anchor: anchorSchema,
    }, required: ['name', 'explanation'] } },
    formulas: { type: 'array', items: { type: 'object', properties: {
      name: { type: 'string' }, expression: { type: 'string' }, latex: { type: 'string' },
      meaning: { type: 'string' }, when_to_use: { type: 'string' },
      variables: { type: 'array', items: { type: 'object', properties: { symbol: { type: 'string' }, meaning: { type: 'string' }, unit: { type: 'string' } }, required: ['symbol', 'meaning'] } },
      source: { type: 'string', enum: ['material', 'transcript'] },
      material_quote: { type: 'string', description: 'If source is material: the exact text of the formula as it appears in the material' },
      anchor: anchorSchema,
    }, required: ['name', 'expression', 'meaning'] } },
    definitions: { type: 'array', items: { type: 'object', properties: {
      term: { type: 'string' }, definition: { type: 'string' },
      source: { type: 'string', enum: ['material', 'transcript'] },
      material_quote: { type: 'string' }, anchor: anchorSchema,
    }, required: ['term', 'definition'] } },
    examples: { type: 'array', items: { type: 'object', properties: {
      title: { type: 'string' }, problem: { type: 'string' },
      steps: { type: 'array', items: { type: 'string' } }, answer: { type: 'string' }, anchor: anchorSchema,
    }, required: ['title', 'problem'] } },
    exam_radar: { type: 'array', items: { type: 'object', properties: {
      note: { type: 'string' }, importance: { type: 'string', enum: ['high', 'medium', 'low'] }, anchor: anchorSchema,
    }, required: ['note'] } },
    misconceptions: { type: 'array', items: { type: 'string' } },
    questions: { type: 'array', items: { type: 'string' } },
    todos: { type: 'array', items: { type: 'object', properties: {
      title: { type: 'string' },
      kind: { type: 'string', enum: ['task', 'read', 'practice', 'submit', 'review', 'prepare'] },
      due_hint: { type: 'string', description: 'What the professor said about when, verbatim-ish, e.g. "before Thursday"' },
    }, required: ['title'] } },
  },
  required: ['one_liner', 'key_takeaways', 'outline', 'concepts'],
};

export function buildEnrichmentPrompt({ transcript, cls, lectureDate, base, materials }) {
  const className = cls?.name || 'this class';
  const instructor = cls?.instructor || 'the professor';
  const materialBlock = materials.length
    ? `PROFESSOR'S MATERIALS (authoritative — these are the actual slides/handouts for this lecture; when the transcript and a material disagree about a formula, symbol, number, or definition, the material is right):\n${materials.map((m) => `--- ${m.file_name} ---\n${m.text}`).join('\n\n')}`
    : 'PROFESSOR\'S MATERIALS: none attached. Every formula and definition comes from the transcript alone; transcribe formulas carefully and reconstruct standard notation where the speech-to-text clearly mangled a symbol (say so in "meaning").';

  return `You are building the definitive study page for one university lecture: "${className}" (${instructor}, ${lectureDate}). A student who missed the class should be able to learn the whole lecture from your output; a student who attended should be able to skim it in two minutes and drill into anything.

Work ONLY from the transcript and materials below. Never invent content that was not taught. Be generous with detail — more useful information is better than less — but every item must be real.

A first pass already produced this summary (use it for orientation, do not repeat it):
Title: ${base.title || ''}
Summary: ${base.summary || ''}

Produce:
1. one_liner — the lecture in one sentence.
2. key_takeaways — 5-10 sentences a student must remember.
3. outline — the lecture as 5-15 sections IN THE ORDER TAUGHT. Each: a heading, a 1-3 sentence summary, 2-6 key_points, and an anchor.
4. concepts — every concept that matters (8-20). For each: explanation (2-4 sentences, teach it), why_it_matters (1 sentence: what it unlocks or where it shows up), difficulty, related (names of other concepts in this list), search_query (the 3-6 word query a student would type to learn more, e.g. "Young's modulus stress strain"), anchor.
5. formulas — EVERY formula or equation mentioned (empty array if truly none). name, expression (plain text, e.g. "σ = F / A"), latex (e.g. "\\\\sigma = \\\\frac{F}{A}"), meaning, when_to_use, variables (each symbol with meaning and unit), anchor. source = "material" ONLY if the formula appears in the materials above, and then material_quote = the exact text from the material; otherwise source = "transcript".
6. definitions — every term the professor defined (source/material_quote rule as for formulas).
7. examples — each worked example or problem the professor walked through: title, the problem, the steps, the answer, anchor.
8. exam_radar — everything said about tests, quizzes, midterms, finals, marking, what will or will not be assessed, what to focus on; importance high/medium/low; anchor.
9. misconceptions — mistakes the professor warned about or that the material invites.
10. questions — 3-8 questions worth asking the professor or TA, based on what was unclear or only mentioned in passing.
11. todos — the tasks the professor actually assigned or clearly expects (readings, problem sets, submissions, things to prepare). title as an imperative ("Read chapter 3.2"), kind, due_hint.

ANCHOR RULE: an anchor is 6-14 consecutive words copied EXACTLY (same spelling, same order) from the transcript at the point where the item is discussed. Do not paraphrase anchors; a paraphrased anchor is useless. If you cannot find a clean quote, leave anchor empty.

TRANSCRIPT:
${transcript}

${materialBlock}`;
}

// ---------------------------------------------------------------------------
// Verification against the real text.

function normalizeForMatch(text) {
  return String(text || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/**
 * Find where a quote occurs in the transcript. Matching is done on a
 * punctuation- and case-insensitive projection of both strings, with a map
 * back to the original offsets, so a quote that differs only by a comma or
 * a capital still resolves. Falls back to the first six words of the quote.
 * Returns -1 when nothing matches: the UI then shows the item without a
 * "show in transcript" link instead of jumping somewhere wrong.
 */
export function locateQuote(transcript, quote) {
  const source = String(transcript || '');
  const wanted = normalizeForMatch(quote);
  if (!source || !wanted) return -1;
  const { projected, offsets } = projectWithOffsets(source);
  const candidates = [wanted];
  const words = wanted.split(' ');
  if (words.length > 6) candidates.push(words.slice(0, 6).join(' '));
  if (words.length > 4) candidates.push(words.slice(-4).join(' '));
  for (const candidate of candidates) {
    if (candidate.split(' ').length < 3) continue;
    const at = projected.indexOf(candidate);
    if (at >= 0) return offsets[at];
  }
  return -1;
}

function projectWithOffsets(source) {
  let projected = '';
  const offsets = [];
  let lastWasSpace = true;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i].toLowerCase();
    if (/[\p{L}\p{N}]/u.test(ch)) {
      projected += ch;
      offsets.push(i);
      lastWasSpace = false;
    } else if (!lastWasSpace) {
      projected += ' ';
      offsets.push(i);
      lastWasSpace = true;
    }
  }
  return { projected, offsets };
}

/** True when `quote` (or the formula's expression) really occurs in the materials text. */
export function quoteAppearsIn(haystack, quote) {
  const wanted = normalizeForMatch(quote);
  if (!wanted || wanted.length < 3) return false;
  return normalizeForMatch(haystack).includes(wanted);
}

function str(value, max) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function strList(value, max, each = 400) {
  return (Array.isArray(value) ? value : []).map((v) => str(v, each)).filter(Boolean).slice(0, max);
}

function anchorFor(transcript, quote) {
  const text = str(quote, 200);
  if (!text) return null;
  const offset = locateQuote(transcript, text);
  return offset >= 0 ? { quote: text, offset } : { quote: text, offset: -1 };
}

/**
 * Turn the model's reply into the stored shape: trims, caps, resolves every
 * anchor, and decides `verified` for formulas and definitions by looking for
 * the claimed material quote (or the expression itself) in the attached
 * materials' text. `materials` is [{ id, file_name, text }].
 */
export function normalizeEnrichment(raw, { transcript = '', materials = [] } = {}) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const materialsText = materials.map((m) => m.text || '').join('\n\n');
  const hasMaterials = materialsText.trim().length > 0;

  const verify = (item, primary) => {
    const claimedMaterial = item?.source === 'material';
    const quote = str(item?.material_quote, 400);
    const verified = hasMaterials && (
      (quote && quoteAppearsIn(materialsText, quote))
      || quoteAppearsIn(materialsText, primary)
    );
    return {
      source: verified ? 'material' : 'transcript',
      verified,
      // Keep the model's claim visible in the data for debugging a mismatch,
      // but never as something the UI trusts.
      claimed_material: claimedMaterial && !verified ? true : undefined,
      material_quote: verified && quote ? quote : undefined,
    };
  };

  const outline = (Array.isArray(data.outline) ? data.outline : []).map((s) => ({
    heading: str(s?.heading, 160),
    summary: str(s?.summary, 1200),
    key_points: strList(s?.key_points, 8),
    anchor: anchorFor(transcript, s?.anchor),
  })).filter((s) => s.heading && s.summary).slice(0, MAX_ITEMS.outline);

  const concepts = (Array.isArray(data.concepts) ? data.concepts : []).map((c) => ({
    name: str(c?.name, 120),
    explanation: str(c?.explanation, 1200),
    why_it_matters: str(c?.why_it_matters, 400),
    difficulty: ['core', 'supporting', 'advanced'].includes(c?.difficulty) ? c.difficulty : 'core',
    related: strList(c?.related, 6, 120),
    search_query: str(c?.search_query, 120),
    anchor: anchorFor(transcript, c?.anchor),
  })).filter((c) => c.name && c.explanation).slice(0, MAX_ITEMS.concepts);
  // Related names must point at concepts that exist, or the UI links to nothing.
  const conceptNames = new Set(concepts.map((c) => c.name.toLowerCase()));
  for (const c of concepts) c.related = c.related.filter((r) => conceptNames.has(r.toLowerCase()) && r.toLowerCase() !== c.name.toLowerCase());

  const formulas = (Array.isArray(data.formulas) ? data.formulas : []).map((f) => {
    const expression = str(f?.expression, 300);
    return {
      name: str(f?.name, 120),
      expression,
      // Models sometimes double-escape backslashes inside JSON strings.
      latex: str(f?.latex, 400).replace(/\\\\/g, '\\'),
      meaning: str(f?.meaning, 800),
      when_to_use: str(f?.when_to_use, 400),
      variables: (Array.isArray(f?.variables) ? f.variables : []).map((v) => ({
        symbol: str(v?.symbol, 40), meaning: str(v?.meaning, 200), unit: str(v?.unit, 60),
      })).filter((v) => v.symbol && v.meaning).slice(0, 12),
      anchor: anchorFor(transcript, f?.anchor),
      ...verify(f, expression),
    };
  }).filter((f) => f.name && f.expression).slice(0, MAX_ITEMS.formulas);

  const definitions = (Array.isArray(data.definitions) ? data.definitions : []).map((d) => {
    const term = str(d?.term, 120);
    return {
      term,
      definition: str(d?.definition, 800),
      anchor: anchorFor(transcript, d?.anchor),
      ...verify(d, term),
    };
  }).filter((d) => d.term && d.definition).slice(0, MAX_ITEMS.definitions);

  const examples = (Array.isArray(data.examples) ? data.examples : []).map((e) => ({
    title: str(e?.title, 160),
    problem: str(e?.problem, 1200),
    steps: strList(e?.steps, 12, 500),
    answer: str(e?.answer, 400),
    anchor: anchorFor(transcript, e?.anchor),
  })).filter((e) => e.title && e.problem).slice(0, MAX_ITEMS.examples);

  const exam_radar = (Array.isArray(data.exam_radar) ? data.exam_radar : []).map((x) => ({
    note: str(x?.note, 500),
    importance: ['high', 'medium', 'low'].includes(x?.importance) ? x.importance : 'medium',
    anchor: anchorFor(transcript, x?.anchor),
  })).filter((x) => x.note).slice(0, MAX_ITEMS.exam_radar);

  const todos = (Array.isArray(data.todos) ? data.todos : []).map((t) => ({
    title: str(t?.title, 300),
    kind: ['task', 'read', 'practice', 'submit', 'review', 'prepare'].includes(t?.kind) ? t.kind : 'task',
    due_hint: str(t?.due_hint, 120),
  })).filter((t) => t.title).slice(0, MAX_ITEMS.todos);

  return {
    version: ENRICHMENT_VERSION,
    generated_at: new Date().toISOString(),
    one_liner: str(data.one_liner, 400),
    key_takeaways: strList(data.key_takeaways, MAX_ITEMS.key_takeaways),
    outline,
    concepts,
    formulas,
    definitions,
    examples,
    exam_radar,
    misconceptions: strList(data.misconceptions, MAX_ITEMS.misconceptions),
    questions: strList(data.questions, MAX_ITEMS.questions),
    todos,
    materials_used: materials.map((m) => ({ id: m.id, file_name: m.file_name })),
    stats: {
      anchors_resolved: [...outline, ...concepts, ...formulas, ...definitions, ...examples, ...exam_radar]
        .filter((i) => i.anchor && i.anchor.offset >= 0).length,
      anchors_total: [...outline, ...concepts, ...formulas, ...definitions, ...examples, ...exam_radar]
        .filter((i) => i.anchor).length,
      verified_formulas: formulas.filter((f) => f.verified).length,
      verified_definitions: definitions.filter((d) => d.verified).length,
    },
  };
}

/** Materials rows → the prompt shape, respecting the size cap. */
export function materialsForPrompt(rows) {
  const out = [];
  let budget = MAX_MATERIALS_CHARS;
  for (const row of rows || []) {
    if (row.extraction_status !== 'ready' || !row.extracted_text) continue;
    const text = String(row.extracted_text).slice(0, budget);
    if (!text) break;
    budget -= text.length;
    out.push({ id: row.id, file_name: row.file_name, text });
    if (budget <= 0) break;
  }
  return out;
}

/**
 * Run the pass. Returns the normalized enrichment; throws on provider
 * failure so callers decide whether that is fatal (it is not for the
 * recording pipeline — the base analysis is already stored).
 */
export async function runEnrichment({ transcript, cls, lectureDate, base, materialRows, llmUsage }) {
  const text = String(transcript || '').slice(0, MAX_TRANSCRIPT_CHARS);
  const materials = materialsForPrompt(materialRows);
  const raw = await invokeLLM({
    model: QUALITY_MODEL,
    usage: llmUsage,
    prompt: buildEnrichmentPrompt({ transcript: text, cls, lectureDate, base, materials }),
    response_json_schema: ENRICHMENT_SCHEMA,
  });
  return normalizeEnrichment(raw, { transcript: text, materials });
}

/**
 * Create to-do rows for a lecture's suggested tasks without duplicating
 * ones that already exist for it (re-running enrichment must not double
 * the list). Returns how many were inserted.
 */
export async function syncLectureTodos(pool, { userId, lecture, todos }) {
  if (!todos?.length) return 0;
  const existing = (await pool.query(
    'select lower(title) as title from todos where lecture_id = $1 and user_id = $2',
    [lecture.id, userId],
  )).rows.map((r) => r.title);
  const have = new Set(existing);
  let inserted = 0;
  for (const [index, todo] of todos.entries()) {
    const key = todo.title.toLowerCase();
    if (have.has(key)) continue;
    have.add(key);
    await pool.query(
      `insert into todos (user_id, class_id, lecture_id, title, detail, kind, source, position)
       values ($1, $2, $3, $4, $5, $6, 'lecture', $7)`,
      [userId, lecture.class_id, lecture.id, todo.title, todo.due_hint ? `Professor said: ${todo.due_hint}` : null, todo.kind, index],
    );
    inserted += 1;
  }
  return inserted;
}
