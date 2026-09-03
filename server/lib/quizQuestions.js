// Every review quiz in Praelecta is multiple choice, and every question the
// model returns is checked here before a student ever sees it.
//
// Why this exists (2 Sep 2026): the first real review session opened on
// "Question 1 of 10" with no question text, an empty type badge, and a free
// text box. The generator had asked for a mix of multiple-choice, true/false
// and short-answer, and nothing validated the reply, so one malformed item
// went straight to the screen. The product decision that followed is simple:
// review quizzes are multiple choice only, graded locally, and the results
// page leads with what was missed and why. This module is the one place that
// enforces the shape.

export const OPTIONS_PER_QUESTION = 4;
const MAX_QUESTION_CHARS = 600;
const MAX_OPTION_CHARS = 300;
const MAX_EXPLANATION_CHARS = 600;

function clean(value, max) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function shuffled(list, seed) {
  // Deterministic Fisher–Yates so the same question set shuffles the same
  // way across a retry; the seed is the question text so the answer key is
  // never sitting in the same slot for a whole quiz (models love option A).
  const out = [...list];
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Normalize a model's question list into the one shape the client renders.
 *
 * Keeps a question only when it has text, at least two distinct non-empty
 * options, and a correct answer that is one of them (matched case- and
 * whitespace-insensitively, so "  photosynthesis" still counts). Everything
 * else is dropped, never "repaired" into something the model did not say.
 * Duplicate question text is collapsed to the first occurrence.
 *
 * Returns `{ questions, dropped }` so callers can log how much the model
 * misbehaved — a sudden spike in `dropped` is the early warning for a model
 * change, exactly the kind of thing that used to surface as a blank screen.
 */
export function normalizeQuizQuestions(raw, { keep = Infinity } = {}) {
  const list = Array.isArray(raw) ? raw : [];
  const seen = new Set();
  const questions = [];
  let dropped = 0;

  for (const item of list) {
    const question = clean(item?.question, MAX_QUESTION_CHARS);
    if (!question) { dropped += 1; continue; }
    const key = question.toLowerCase();
    if (seen.has(key)) { dropped += 1; continue; }

    const options = [];
    const optionKeys = new Set();
    for (const rawOption of (Array.isArray(item?.options) ? item.options : [])) {
      const option = clean(rawOption, MAX_OPTION_CHARS);
      const optionKey = option.toLowerCase();
      if (!option || optionKeys.has(optionKey)) continue;
      optionKeys.add(optionKey);
      options.push(option);
      if (options.length === OPTIONS_PER_QUESTION) break;
    }
    if (options.length < 2) { dropped += 1; continue; }

    const wanted = clean(item?.correct_answer, MAX_OPTION_CHARS).toLowerCase();
    const correct = options.find((o) => o.toLowerCase() === wanted);
    if (!correct) { dropped += 1; continue; }

    seen.add(key);
    questions.push({
      type: 'multiple_choice',
      question,
      options: shuffled(options, question),
      correct_answer: correct,
      explanation: clean(item?.explanation, MAX_EXPLANATION_CHARS),
      concept: clean(item?.concept, 120),
      lecture_index: Number.isInteger(item?.lecture_index) && item.lecture_index > 0 ? item.lecture_index : undefined,
      flow_position: ['start', 'middle', 'end'].includes(item?.flow_position) ? item.flow_position : undefined,
    });
    if (questions.length >= keep) break;
  }

  return { questions, dropped };
}

/** The response schema every quiz generator asks the model for. */
export const QUIZ_QUESTION_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['multiple_choice'] },
    question: { type: 'string' },
    options: { type: 'array', items: { type: 'string' } },
    correct_answer: { type: 'string' },
    explanation: { type: 'string' },
    concept: { type: 'string' },
    lecture_index: { type: 'number' },
    flow_position: { type: 'string', enum: ['start', 'middle', 'end'] },
  },
  required: ['question', 'options', 'correct_answer', 'explanation'],
};

/** Prompt fragment shared by every generator so the rules never drift. */
export const QUIZ_FORMAT_RULES = `Question format (strict):
- EVERY question is multiple choice with EXACTLY ${OPTIONS_PER_QUESTION} options. No short-answer, no one-word, no true/false, no problems requiring written work.
- Exactly one option is correct; "correct_answer" must be copied verbatim from "options".
- Distractors must be plausible and drawn from the same lecture material (common confusions, neighbouring concepts, sign/unit mistakes), never obviously wrong or silly.
- Vary which option is correct; do not put the answer first every time.
- "explanation": one or two sentences that teach the point — why the correct option is right and what the most tempting distractor gets wrong. Written for a student reviewing what they missed.
- Never return a question with empty text or fewer than ${OPTIONS_PER_QUESTION} options; leave it out instead.`;
