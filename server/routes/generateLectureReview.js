import express from 'express';
import crypto from 'node:crypto';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { invokeLLM, createLlmUsage, QUALITY_MODEL } from '../lib/llm.js';
import { gateFeature, settleFeature, getBalance } from '../lib/credits.js';
import { normalizeQuizQuestions, QUIZ_QUESTION_SCHEMA, QUIZ_FORMAT_RULES } from '../lib/quizQuestions.js';

// Direct port of base44/functions/generateLectureReview/entry.ts. Two modes:
// grading (free — the student already paid for the questions, charging again
// to mark answers would bill the same purchase twice) and generation (billed).
//
// Since 2 Sep 2026 generation is multiple choice only and every question is
// validated by lib/quizQuestions.js before it leaves the server (see the
// note there for the blank-question incident). The grading mode is kept for
// any older client still holding written answers; no current screen calls it.

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { lecture_ids, scope, quick_quiz, question_count, grade_answers, local_date } = req.body || {};

    if (grade_answers && Array.isArray(grade_answers) && grade_answers.length > 0) {
      const gradingUsage = createLlmUsage();
      const gradingGate = { ok: true, balance: await getBalance(userId), cost: 0, startedAt: Date.now(), operationId: crypto.randomUUID() };
      const items = grade_answers.map((g, i) => `Item ${i + 1}:\nQuestion: ${g.question}\nModel answer (the key idea): ${g.correct_answer || '(none provided)'}\nStudent's answer: ${g.student_answer || '(blank)'}`).join('\n\n');

      const grading = await invokeLLM({
        model: QUALITY_MODEL, usage: gradingUsage,
        prompt: `You are grading short-answer responses on a university review quiz. Judge each answer ONLY on whether the student demonstrates a correct grasp of the underlying concept. Do NOT require the wording to match the model answer — paraphrases, different examples, and informal phrasing are fully acceptable as long as the core understanding is right. Mark wrong only when the concept is missing, misunderstood, or materially incorrect. A blank or off-topic answer is incorrect.

For each item return:
- "correct": true or false (did they grasp the concept?)
- "feedback": one short sentence — if correct, affirm what they got; if incorrect, say specifically what they missed or misunderstood (not just "wrong").

${items}

Return JSON: { "results": [ { "correct": boolean, "feedback": string }, ... ] } in the SAME order as the items.`,
        response_json_schema: { type: 'object', properties: { results: { type: 'array', items: { type: 'object', properties: { correct: { type: 'boolean' }, feedback: { type: 'string' } } } } } },
      });
      await settleFeature(gradingGate, { feature: 'lecture_review', llmUsage: gradingUsage });
      return res.json({ results: grading.results || [] });
    }

    const gate = await gateFeature(userId, 'lecture_review', res);
    if (!gate.ok) return;
    const llmUsage = createLlmUsage();

    let targetLectures = [];
    if (lecture_ids && lecture_ids.length > 0) {
      const { rows } = await pool.query('select * from lectures where id = any($1::uuid[]) and user_id = $2', [lecture_ids, userId]);
      targetLectures = rows;
    } else {
      // "Today" and "this week" mean the student's local calendar day, not the
      // server's UTC day. Lectures are stored with the local date they were
      // recorded on (RecordingContext), so a UTC "today" here would miss an
      // evening lecture the moment UTC rolls past midnight — which is exactly
      // what "no lectures to review today" was, right after a real recording.
      // The client sends its local date; fall back to UTC only if it is absent
      // or malformed.
      const today = (typeof local_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(local_date))
        ? local_date
        : new Date().toISOString().split('T')[0];
      if (scope === 'today') {
        targetLectures = (await pool.query('select * from lectures where date = $1 and user_id = $2 order by date', [today, userId])).rows;
      } else if (scope === 'week') {
        // Seven days back from the student's local today, and the range check
        // is done by Postgres on the DATE column itself rather than by comparing
        // rows in JS, so there is no representation mismatch to get wrong.
        targetLectures = (await pool.query(
          "select * from lectures where user_id = $1 and date between ($2::date - interval '7 days') and $2::date order by date desc limit 50",
          [userId, today],
        )).rows;
      }
    }

    const lecturesWithContent = targetLectures.filter((l) => l.transcript || l.ai_summary || (l.ai_concepts || []).length > 0);
    if (lecturesWithContent.length === 0) {
      // Say which of the two things happened: nothing in the window, or
      // lectures in the window that have not finished processing yet.
      const unprocessed = targetLectures.length;
      const windowLabel = scope === 'today' ? 'today' : scope === 'week' ? 'in the past week' : 'for this selection';
      const message = unprocessed > 0
        ? `${unprocessed} lecture${unprocessed === 1 ? '' : 's'} ${windowLabel} ${unprocessed === 1 ? 'is' : 'are'} still processing. Check back in a few minutes.`
        : `No lectures recorded ${windowLabel} yet.`;
      return res.json({ review_questions: [], lecture_flow: [], message });
    }

    const sorted = lecturesWithContent.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const classIds = [...new Set(sorted.map((l) => l.class_id).filter(Boolean))];
    let cls = null;
    if (classIds.length === 1) {
      cls = (await pool.query('select * from classes where id = $1 and user_id = $2', [classIds[0], userId])).rows[0] || null;
    }

    const lectureContext = sorted.map((l, idx) => {
      const concepts = (l.ai_concepts || []).join(', ');
      const title = l.ai_title || `Lecture on ${l.date}`;
      return `=== LECTURE ${idx + 1} (Date: ${l.date}) — ${title} ===\nSummary: ${l.ai_summary || ''}\nKey Concepts: ${concepts}\nTranscript excerpt (following professor's teaching order):\n${(l.transcript || '').substring(0, 3000)}`;
    }).join('\n\n---\n\n');

    const className = cls?.name || (classIds.length > 1 ? 'multiple classes' : 'this class');
    const quickQuizMode = quick_quiz === true;
    const questionCount = question_count ? String(question_count) : (quickQuizMode ? '5-7' : '10');
    const difficultyInstruction = quickQuizMode
      ? `FOCUS: Generate ONLY the hardest, most exam-likely questions. Prioritize formulas, complex definitions, multi-step concepts, and topics explicitly flagged as exam material. Avoid easy recall questions — these should challenge a student who has already studied.`
      : `Difficulty: a normal review mix — not trivial, but not all hardest-level.`;
    const buildPrompt = (retry) => `You are an academic tutor creating a review quiz that follows the EXACT teaching flow the professor used across ${sorted.length} lecture(s) for "${className}".
${retry ? '\nIMPORTANT: your previous attempt returned questions that failed validation. "correct_answer" must be the option text ITSELF, copied exactly — never a label like "A", "B)", or "1.".\n' : ''}
CRITICAL: The questions MUST follow the chronological order of how topics were taught. Start with what the professor discussed FIRST in the earliest lecture, and progress through to what was discussed LAST in the most recent lecture. This creates a natural review flow that mirrors the actual learning sequence.

Generate ${questionCount} review questions that trace the teaching flow:
- The first 1-2 questions should cover topics from the BEGINNING of the earliest lecture
- Middle questions should cover topics in the order they were introduced across lectures
- The last 1-2 questions should cover topics from the END of the most recent lecture

For each question, include a "lecture_index" (1-based) and "flow_position" ("start", "middle", or "end") indicating where in the teaching flow this topic appeared.

${difficultyInstruction}

${QUIZ_FORMAT_RULES}

Also generate a "teaching_flow" array that lists the major topics in the order they were taught across all lectures.

LECTURE CONTENT (in chronological teaching order):
${lectureContext}

Return a JSON object with:
- review_questions: array of {type: "multiple_choice", question, options (exactly 4), correct_answer, explanation, concept, lecture_index, flow_position}
- teaching_flow: array of {topic, lecture_index} — the major topics in the order they were taught`;

    const reviewSchema = {
      type: 'object',
      properties: {
        review_questions: { type: 'array', items: QUIZ_QUESTION_SCHEMA },
        teaching_flow: { type: 'array', items: { type: 'object', properties: { topic: { type: 'string' }, lecture_index: { type: 'number' } } } },
      },
    };

    // One retry if every question the model returned failed validation
    // (added 3 Sep 2026 — see the note in quizQuestions.js for what this
    // caught). Never retries on a genuinely empty scope; only on "the model
    // tried and got the shape wrong". Both attempts settle together, once,
    // after the final result — gateFeature already charged nothing yet.
    let result = await invokeLLM({ usage: llmUsage, prompt: buildPrompt(false), response_json_schema: reviewSchema });
    let { questions, dropped } = normalizeQuizQuestions(result?.review_questions);
    if (questions.length === 0 && dropped > 0) {
      console.warn(`[lecture-review] all ${dropped} question(s) failed validation for user ${userId}; retrying once with a stricter prompt`);
      result = await invokeLLM({ usage: llmUsage, prompt: buildPrompt(true), response_json_schema: reviewSchema });
      ({ questions, dropped } = normalizeQuizQuestions(result?.review_questions));
    }
    if (dropped > 0) console.warn(`[lecture-review] dropped ${dropped} malformed question(s) from the model for user ${userId}`);

    await settleFeature(gate, { feature: 'lecture_review', llmUsage });

    if (questions.length === 0) {
      // The model engaged with the content (teaching_flow below proves it
      // read the lectures) but never produced a usable question, even after
      // a retry. Say so plainly — the old fallback message here claimed "no
      // lecture content available", which was actively misleading when the
      // student had lectures right there.
      return res.json({
        review_questions: [], teaching_flow: result.teaching_flow || [],
        lecture_count: sorted.length, lecture_dates: sorted.map((l) => l.date),
        lecture_titles: sorted.map((l) => l.ai_title || `Lecture — ${l.date}`),
        message: "Couldn't generate review questions from this content — please try again.",
      });
    }

    res.json({
      review_questions: questions, teaching_flow: result.teaching_flow || [],
      lecture_count: sorted.length, lecture_dates: sorted.map((l) => l.date),
      lecture_titles: sorted.map((l) => l.ai_title || `Lecture — ${l.date}`),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
