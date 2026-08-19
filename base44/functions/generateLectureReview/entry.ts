import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { invokeLLM, createLlmUsage, QUALITY_MODEL } from '../../shared/llm.ts';
import { gateFeature, settleFeature, getBalance } from '../../shared/credits.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { lecture_ids, scope, quick_quiz, question_count, grade_answers } = body;
    // scope: 'today' | 'week' | 'specific'
    // If lecture_ids provided, use those. Otherwise derive from scope.
    // quick_quiz: if true, generate harder questions focused on exam-likely material
    // question_count: optional override for number of questions
    // grade_answers: if present, run concept-based grading instead of generating.

    // ---- Grading mode -------------------------------------------------------
    // The frontend sends the short-answer questions the student wrote free text
    // for, plus their responses. We judge each on whether it demonstrates grasp
    // of the underlying concept — NOT on how closely the wording matches — and
    // return a short note on what was missed. Batched into ONE call for speed.
    if (grade_answers && Array.isArray(grade_answers) && grade_answers.length > 0) {
      const gradingUsage = createLlmUsage();
      const gradingGate = {
        ok: true,
        balance: await getBalance(base44, user.id),
        cost: 0,
        startedAt: Date.now(),
        operationId: crypto.randomUUID(),
      };
      const items = grade_answers.map((g, i) => `Item ${i + 1}:
Question: ${g.question}
Model answer (the key idea): ${g.correct_answer || '(none provided)'}
Student's answer: ${g.student_answer || '(blank)'}`).join('\n\n');

      // Quality model: this decides whether a student's answer counts as
      // correct, which feeds KnowledgeCoverage and the proficiency stats.
      const grading = await invokeLLM(base44, {
        model: QUALITY_MODEL,
        usage: gradingUsage,
        prompt: `You are grading short-answer responses on a university review quiz. Judge each answer ONLY on whether the student demonstrates a correct grasp of the underlying concept. Do NOT require the wording to match the model answer — paraphrases, different examples, and informal phrasing are fully acceptable as long as the core understanding is right. Mark wrong only when the concept is missing, misunderstood, or materially incorrect. A blank or off-topic answer is incorrect.

For each item return:
- "correct": true or false (did they grasp the concept?)
- "feedback": one short sentence — if correct, affirm what they got; if incorrect, say specifically what they missed or misunderstood (not just "wrong").

${items}

Return JSON: { "results": [ { "correct": boolean, "feedback": string }, ... ] } in the SAME order as the items.`,
        response_json_schema: {
          type: 'object',
          properties: {
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  correct: { type: 'boolean' },
                  feedback: { type: 'string' },
                },
              },
            },
          },
        },
      });
      await settleFeature(base44, gradingGate, {
        feature: 'lecture_review',
        llmUsage: gradingUsage,
      });
      return Response.json({ results: grading.results || [] });
    }
    // ---- End grading mode ---------------------------------------------------

    // Gate the review GENERATION only. Grading returns above and stays free:
    // the student already paid for these questions, so charging again to mark
    // their answers would bill the same purchase twice.
    const gate = await gateFeature(base44, user.id, 'lecture_review');
    if (!gate.ok) return gate.response!;
    const llmUsage = createLlmUsage();

    let targetLectures = [];

    if (lecture_ids && lecture_ids.length > 0) {
      for (const id of lecture_ids) {
        try {
          const lec = await base44.entities.Lecture.get(id);
          targetLectures.push(lec);
        } catch (e) { /* skip */ }
      }
    } else {
      const today = new Date().toISOString().split('T')[0];
      if (scope === 'today') {
        const allLecs = await base44.entities.Lecture.filter({ date: today }, 'date');
        targetLectures = allLecs;
      } else if (scope === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgoStr = weekAgo.toISOString().split('T')[0];
        const allLecs = await base44.entities.Lecture.list('-date', 50);
        targetLectures = allLecs.filter(l => l.date >= weekAgoStr && l.date <= today);
      }
    }

    // Filter to lectures with content
    const lecturesWithContent = targetLectures.filter(l => l.transcript || l.ai_summary || (l.ai_concepts && l.ai_concepts.length > 0));

    if (lecturesWithContent.length === 0) {
      return Response.json({
        review_questions: [],
        lecture_flow: [],
        message: 'No lecture content available for review yet.',
      });
    }

    // Sort chronologically by date (oldest first) — this is the teaching flow
    const sorted = lecturesWithContent.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    // Get class info for context
    const classIds = [...new Set(sorted.map(l => l.class_id).filter(Boolean))];
    let cls = null;
    if (classIds.length === 1) {
      try { cls = await base44.entities.Class.get(classIds[0]); } catch (e) { /* skip */ }
    }

    // Build context in chronological order — following the exact teaching flow
    const lectureContext = sorted.map((l, idx) => {
      const concepts = (l.ai_concepts || []).join(', ');
      const summary = l.ai_summary || '';
      const title = l.ai_title || `Lecture on ${l.date}`;
      const lectureDate = l.date;
      const transcriptSnippet = (l.transcript || '').substring(0, 3000);
      return `=== LECTURE ${idx + 1} (Date: ${lectureDate}) — ${title} ===
Summary: ${summary}
Key Concepts: ${concepts}
Transcript excerpt (following professor's teaching order):
${transcriptSnippet}`;
    }).join('\n\n---\n\n');

    const className = cls?.name || (classIds.length > 1 ? 'multiple classes' : 'this class');

    const quickQuizMode = quick_quiz === true;
    const questionCount = question_count ? String(question_count) : (quickQuizMode ? '5-7' : '10');
    const difficultyInstruction = quickQuizMode
      ? `FOCUS: Generate ONLY the hardest, most exam-likely questions. Prioritize formulas, complex definitions, multi-step concepts, and topics explicitly flagged as exam material. Avoid easy recall questions — these should challenge a student who has already studied.`
      : `Difficulty: a normal review mix — not trivial, but not all hardest-level.`;

    // Question-type balance: lean on multiple choice and true/false (both are
    // objectively gradable), and keep short answer to a MINIMUM — at most 1-2
    // per quiz — since those require judging understanding rather than matching.
    const typeMixInstruction = `Question-type mix (important):
- Make MOST questions "multiple_choice" (4 options each).
- Include a few "true_false" questions (these should be a real claim to judge; options are exactly ["True", "False"] and correct_answer is "True" or "False").
- Include AT MOST 1-2 "short_answer" questions total, and only where a written explanation genuinely tests understanding better than a choice would. If nothing warrants it, use none.
- Avoid "one_word" unless a term truly has a single unambiguous answer.
For every question, set correct_answer to the ideal/model answer. For short_answer, correct_answer should be a concise model answer capturing the key idea a correct response must convey.`;

    const result = await invokeLLM(base44, {
      usage: llmUsage,
      prompt: `You are an academic tutor creating a review quiz that follows the EXACT teaching flow the professor used across ${sorted.length} lecture(s) for "${className}".

CRITICAL: The questions MUST follow the chronological order of how topics were taught. Start with what the professor discussed FIRST in the earliest lecture, and progress through to what was discussed LAST in the most recent lecture. This creates a natural review flow that mirrors the actual learning sequence.

Generate ${questionCount} review questions that trace the teaching flow:
- The first 1-2 questions should cover topics from the BEGINNING of the earliest lecture
- Middle questions should cover topics in the order they were introduced across lectures
- The last 1-2 questions should cover topics from the END of the most recent lecture

For each question, include a "lecture_index" (1-based) and "flow_position" ("start", "middle", or "end") indicating where in the teaching flow this topic appeared.

${difficultyInstruction}

${typeMixInstruction}

Also generate a "teaching_flow" array that lists the major topics in the order they were taught across all lectures.

LECTURE CONTENT (in chronological teaching order):
${lectureContext}

Return a JSON object with:
- review_questions: array of {type, question, options (array, empty for non-MC), correct_answer, concept, lecture_index, flow_position}
- teaching_flow: array of {topic, lecture_index} — the major topics in the order they were taught`,
      response_json_schema: {
        type: 'object',
        properties: {
          review_questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['multiple_choice', 'true_false', 'short_answer', 'one_word'] },
                question: { type: 'string' },
                options: { type: 'array', items: { type: 'string' } },
                correct_answer: { type: 'string' },
                concept: { type: 'string' },
                lecture_index: { type: 'number' },
                flow_position: { type: 'string', enum: ['start', 'middle', 'end'] }
              }
            }
          },
          teaching_flow: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                topic: { type: 'string' },
                lecture_index: { type: 'number' }
              }
            }
          }
        }
      }
    });

    await settleFeature(base44, gate, {
      feature: 'lecture_review',
      llmUsage,
    });

    return Response.json({
      review_questions: result.review_questions || [],
      teaching_flow: result.teaching_flow || [],
      lecture_count: sorted.length,
      lecture_dates: sorted.map(l => l.date),
      lecture_titles: sorted.map(l => l.ai_title || `Lecture — ${l.date}`),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});