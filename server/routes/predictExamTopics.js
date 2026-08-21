import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { invokeLLM, createLlmUsage, QUALITY_MODEL } from '../lib/llm.js';
import { gateFeature, settleFeature } from '../lib/credits.js';

// Direct port of base44/functions/predictExamTopics/entry.ts.

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { class_id } = req.body || {};
    if (!class_id) return res.status(400).json({ error: 'class_id is required' });

    const { rows: lectures } = await pool.query('select * from lectures where class_id = $1 and user_id = $2 order by date desc', [class_id, userId]);
    const { rows: assignments } = await pool.query('select * from assignments where class_id = $1 and user_id = $2', [class_id, userId]);

    const lecturesWithContent = lectures.filter((l) => l.ai_summary || l.transcript || (l.ai_concepts || []).length > 0);
    if (lecturesWithContent.length === 0) {
      return res.json({ topics: [], message: 'Not enough lecture data to make predictions yet.' });
    }

    const gate = await gateFeature(userId, 'exam_prediction', res);
    if (!gate.ok) return;
    const llmUsage = createLlmUsage();

    const conceptFrequency = {}, examMentions = {}, formulaFrequency = {}, definitionTerms = {};
    for (const lec of lecturesWithContent) {
      for (const c of (lec.ai_concepts || [])) { const k = c.toLowerCase().trim(); conceptFrequency[k] = (conceptFrequency[k] || 0) + 1; }
      for (const m of (lec.ai_exam_mentions || [])) { const k = m.toLowerCase().trim(); examMentions[k] = (examMentions[k] || 0) + 3; }
      for (const f of (lec.ai_formulas || [])) { const k = f.toLowerCase().trim().substring(0, 60); formulaFrequency[k] = (formulaFrequency[k] || 0) + 2; }
      for (const d of (lec.ai_definitions || [])) { if (d.term) { const k = d.term.toLowerCase().trim(); definitionTerms[k] = (definitionTerms[k] || 0) + 1; } }
    }

    const allTopics = new Set([...Object.keys(conceptFrequency), ...Object.keys(examMentions), ...Object.keys(definitionTerms)]);
    const scoredTopics = [];
    for (const topic of allTopics) {
      const score = (conceptFrequency[topic] || 0) * 2 + (examMentions[topic] || 0) * 3 + (definitionTerms[topic] || 0) * 1.5 + (formulaFrequency[topic] || 0) * 1;
      scoredTopics.push({ topic, score, frequency: conceptFrequency[topic] || 0, exam_mentioned: (examMentions[topic] || 0) > 0 });
    }
    scoredTopics.sort((a, b) => b.score - a.score);

    const todayStr = new Date().toISOString().split('T')[0];
    const upcomingExam = assignments
      .filter((a) => (a.type === 'exam' || a.type === 'quiz') && a.due_date >= todayStr)
      .sort((a, b) => a.due_date.localeCompare(b.due_date))[0] || null;

    const totalLectures = lectures.length;
    const reviewedLectures = lectures.filter((l) => l.is_missed === false).length;
    const coveragePercent = totalLectures > 0 ? Math.round((reviewedLectures / totalLectures) * 100) : 0;

    const topTopics = scoredTopics.slice(0, 15);
    const lectureSummaries = lecturesWithContent.slice(-10).map((l) => `[${l.date}] ${l.ai_title || 'Untitled'}: ${l.ai_summary || ''} | Concepts: ${(l.ai_concepts || []).join(', ')} | Exam mentions: ${(l.ai_exam_mentions || []).join(', ')}`).join('\n');

    const prediction = await invokeLLM({
      usage: llmUsage, model: QUALITY_MODEL,
      prompt: `You are an academic exam predictor AI. Based on the student's lecture data, predict which topics are most likely to appear on the upcoming exam.

Lecture data (most recent 10):
${lectureSummaries}

Frequency analysis (concepts that appeared across lectures):
${topTopics.map((t) => `${t.topic}: appeared ${t.frequency} times${t.exam_mentioned ? ' (professor mentioned as exam-relevant)' : ''}`).join('\n')}

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
          high_priority: { type: 'array', items: { type: 'object', properties: { topic: { type: 'string' }, reason: { type: 'string' }, confidence: { type: 'string', enum: ['high', 'medium', 'low'] } } } },
          medium_priority: { type: 'array', items: { type: 'object', properties: { topic: { type: 'string' }, reason: { type: 'string' } } } },
          gaps: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' },
        },
      },
    });

    await settleFeature(gate, { feature: 'exam_prediction', llmUsage, extra: { class_id } });

    res.json({ prediction, stats: { total_lectures: totalLectures, coverage_percent: coveragePercent, upcoming_exam: upcomingExam ? upcomingExam.due_date : null } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
