import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { invokeLLM, QUALITY_MODEL } from '../../shared/llm.ts';
import { secrets } from 'base44:runtime';
import { gateFeature, settleFeature } from '../../shared/credits.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { class_id } = body;
    if (!class_id) return Response.json({ error: 'class_id is required' }, { status: 400 });

    const lectures = await base44.entities.Lecture.filter({ class_id }, '-date');
    const assignments = await base44.entities.Assignment.filter({ class_id });

    const lecturesWithContent = lectures.filter(l => l.ai_summary || l.transcript || (l.ai_concepts && l.ai_concepts.length > 0));
    if (lecturesWithContent.length === 0) {
      return Response.json({ topics: [], message: 'Not enough lecture data to make predictions yet.' });
    }

    // Gate after the data check — "not enough data yet" is not billable.
    const gate = await gateFeature(base44, user.id, 'exam_prediction', { class_id });
    if (!gate.ok) return gate.response!;

    // Aggregate concept frequency across all lectures
    const conceptFrequency = {};
    const examMentions = {};
    const formulaFrequency = {};
    const definitionTerms = {};

    for (const lec of lecturesWithContent) {
      for (const concept of (lec.ai_concepts || [])) {
        const key = concept.toLowerCase().trim();
        conceptFrequency[key] = (conceptFrequency[key] || 0) + 1;
      }
      for (const mention of (lec.ai_exam_mentions || [])) {
        const key = mention.toLowerCase().trim();
        examMentions[key] = (examMentions[key] || 0) + 3; // exam mentions weighted higher
      }
      for (const formula of (lec.ai_formulas || [])) {
        const key = formula.toLowerCase().trim().substring(0, 60);
        formulaFrequency[key] = (formulaFrequency[key] || 0) + 2;
      }
      for (const def of (lec.ai_definitions || [])) {
        if (def.term) {
          const key = def.term.toLowerCase().trim();
          definitionTerms[key] = (definitionTerms[key] || 0) + 1;
        }
      }
    }

    // Combine into a scored topic list
    const allTopics = new Set([...Object.keys(conceptFrequency), ...Object.keys(examMentions), ...Object.keys(definitionTerms)]);
    const scoredTopics = [];
    for (const topic of allTopics) {
      const score = (conceptFrequency[topic] || 0) * 2 + (examMentions[topic] || 0) * 3 + (definitionTerms[topic] || 0) * 1.5 + (formulaFrequency[topic] || 0) * 1;
      scoredTopics.push({ topic, score, frequency: conceptFrequency[topic] || 0, exam_mentioned: (examMentions[topic] || 0) > 0 });
    }
    scoredTopics.sort((a, b) => b.score - a.score);

    // Determine coverage scope based on upcoming exam
    const upcomingExam = assignments
      .filter(a => (a.type === 'exam' || a.type === 'quiz') && a.due_date >= new Date().toISOString().split('T')[0])
      .sort((a, b) => a.due_date.localeCompare(b.due_date))[0] || null;

    const totalLectures = lectures.length;
    const reviewedLectures = lectures.filter(l => l.is_missed === false).length;
    const coveragePercent = totalLectures > 0 ? Math.round((reviewedLectures / totalLectures) * 100) : 0;

    // Build context for AI prediction
    const topTopics = scoredTopics.slice(0, 15);
    const lectureSummaries = lecturesWithContent.slice(-10).map(l => `[${l.date}] ${l.ai_title || 'Untitled'}: ${l.ai_summary || ''} | Concepts: ${(l.ai_concepts || []).join(', ')} | Exam mentions: ${(l.ai_exam_mentions || []).join(', ')}`).join('\n');

    const prediction = await invokeLLM(base44, {
      model: QUALITY_MODEL,
      prompt: `You are an academic exam predictor AI. Based on the student's lecture data, predict which topics are most likely to appear on the upcoming exam.

Lecture data (most recent 10):
${lectureSummaries}

Frequency analysis (concepts that appeared across lectures):
${topTopics.map(t => `${t.topic}: appeared ${t.frequency} times${t.exam_mentioned ? ' (professor mentioned as exam-relevant)' : ''}`).join('\n')}

${upcomingExam ? `Upcoming ${upcomingExam.type} on ${upcomingExam.due_date} (scope: ${upcomingExam.coverage_scope})` : 'No upcoming exam scheduled'}

Rules:
1. Rank topics by likelihood of appearing on the exam (High/Medium/Low)
2. For each topic, give a brief reason based on the data
3. Identify 3-5 "high priority" topics
4. Note any topics the professor explicitly mentioned as exam-relevant
5. If there are gaps in coverage (missed lectures), note them`,
      response_json_schema: {
        type: 'object',
        properties: {
          high_priority: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                topic: { type: 'string' },
                reason: { type: 'string' },
                confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
              },
            },
          },
          medium_priority: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                topic: { type: 'string' },
                reason: { type: 'string' },
              },
            },
          },
          gaps: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' },
        },
      },
      add_context_from_internet: false,
    });

    await settleFeature(base44, gate, {
      feature: 'exam_prediction',
      calls: 1,
      usedGemini: !!secrets.get('GEMINI_API_KEY'),
      extra: { class_id },
    });

    return Response.json({
      prediction,
      stats: {
        total_lectures: totalLectures,
        coverage_percent: coveragePercent,
        upcoming_exam: upcomingExam ? upcomingExam.due_date : null,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});