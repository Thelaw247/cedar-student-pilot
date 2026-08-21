import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { invokeLLM, QUALITY_MODEL } from '../lib/llm.js';

// Direct port of base44/functions/academicAIChat/entry.ts — DISABLED,
// matching its current withdrawn state in Base44. Same kill-switch pattern:
// checked before any auth or LLM work, fails closed. Implementation kept
// intact underneath for reintegration later, exactly as the original intended.
// Re-enable by setting ACADEMIC_CHAT_ENABLED=true on Render.

const router = express.Router();
const CHAT_ENABLED = () => process.env.ACADEMIC_CHAT_ENABLED === 'true';

router.post('/', async (req, res) => {
  if (!CHAT_ENABLED()) {
    return res.status(403).json({ error: 'feature_disabled', message: 'AI chat is not available yet.' });
  }
  requireAuth(req, res, async () => {
    try {
      const userId = req.user.id;
      const { message, class_id } = req.body || {};
      if (!message) return res.status(400).json({ error: 'message is required' });

      const semesters = (await pool.query('select * from semesters where user_id = $1 and is_active = true', [userId])).rows;
      let allLectures = [];

      if (semesters.length > 0) {
        const classes = (await pool.query('select * from classes where semester_id = $1 and user_id = $2', [semesters[0].id, userId])).rows;
        const targetClasses = class_id ? classes.filter((c) => c.id === class_id) : classes;

        for (const cls of targetClasses) {
          const lectures = (await pool.query('select * from lectures where class_id = $1 and user_id = $2 order by date desc', [cls.id, userId])).rows;
          for (const lec of lectures) {
            if (!lec.transcript && !lec.ai_summary) continue;
            allLectures.push({ lecture: lec, className: cls.name, classId: cls.id });
          }
        }

        const keywords = message.toLowerCase().split(/\s+/).filter((w) => w.length > 4)
          .filter((w) => !['what', 'how', 'why', 'when', 'where', 'which', 'about', 'explain', 'describe', 'should', 'would', 'could', 'there'].includes(w));

        let matchedLectures = [], relatedLectures = [];
        for (const entry of allLectures) {
          const content = ((entry.lecture.transcript || '') + ' ' + (entry.lecture.ai_summary || '') + ' ' + (entry.lecture.ai_concepts || []).join(' ')).toLowerCase();
          const matchScore = keywords.filter((kw) => content.includes(kw)).length;
          if (matchScore >= 2) matchedLectures.push({ ...entry, matchScore });
          else if (matchScore >= 1) relatedLectures.push({ ...entry, matchScore });
        }
        matchedLectures.sort((a, b) => b.matchScore - a.matchScore);
        relatedLectures.sort((a, b) => b.matchScore - a.matchScore);

        const sourceLectures = matchedLectures.length > 0 ? matchedLectures.slice(0, 5) : relatedLectures.slice(0, 3);
        const fallbackLevel = matchedLectures.length > 0 ? 1 : (relatedLectures.length > 0 ? 2 : 3);

        const classContext = sourceLectures.map((entry) => {
          const lec = entry.lecture;
          const transcriptSnippet = lec.transcript ? lec.transcript.substring(0, 800) : '';
          return `[Lecture ID: ${lec.id}] [Date: ${lec.date}] [Class: ${entry.className}]\nTitle: ${lec.ai_title || 'Untitled'}\nSummary: ${lec.ai_summary || ''}\nTranscript excerpt: ${transcriptSnippet}`;
        }).join('\n\n---\n\n');

        const citations = sourceLectures.map((entry) => ({ lecture_id: entry.lecture.id, lecture_title: entry.lecture.ai_title || `Lecture ${entry.lecture.date}`, date: entry.lecture.date, class_name: entry.className }));

        const assignmentContext = [];
        for (const cls of (class_id ? targetClasses : classes)) {
          const assignments = (await pool.query('select * from assignments where class_id = $1 and user_id = $2', [cls.id, userId])).rows;
          for (const a of assignments) assignmentContext.push(`${a.title} (${a.type}) for ${cls.name} - due ${a.due_date}`);
        }
        const assignmentInfo = assignmentContext.length > 0 ? `\n\nUpcoming assignments:\n${assignmentContext.join('\n')}` : '';

        const systemPrompt = fallbackLevel < 3
          ? `You are an AI academic assistant. The student asked a question. You have their actual lecture content below.

CRITICAL RULES:
1. ONLY use the lecture content provided below to answer. NEVER fabricate or invent lecture content.
2. If the lecture content does not contain enough information to answer, clearly state: "This topic was not covered in your recorded lectures."
3. When referencing a lecture, ALWAYS cite it by date and include the lecture title.
4. Quote directly from transcripts when possible.
5. If you must make an assumption, label it explicitly: "[Assumption] ..."
6. Do not present general knowledge as if it came from the student's lectures.

Lecture content (with IDs for citation):
${classContext}${assignmentInfo}

Student question: ${message}

Answer the question using ONLY the lecture content above. Cite specific lectures by date. If the topic isn't covered, say so.`
          : `You are an AI academic assistant. The student asked a question, but no matching lecture content was found in their recordings.

RULES:
1. Clearly state that this topic was not found in their recorded lectures.
2. You may provide a general explanation, but MUST label it as general knowledge: "This wasn't covered in your lectures. Here's a general explanation:"
3. Recommend they check their syllabus or ask their professor.
4. Never fabricate lecture references.

Student question: ${message}`;

        const answer = await invokeLLM({
          model: QUALITY_MODEL, prompt: systemPrompt,
          response_json_schema: { type: 'object', properties: { answer: { type: 'string' }, fallback_level: { type: 'number' }, citations: { type: 'array', items: { type: 'object', properties: { lecture_id: { type: 'string' }, lecture_title: { type: 'string' }, date: { type: 'string' }, class_name: { type: 'string' } } } }, topic_covered: { type: 'boolean' } } },
        });

        return res.json({ answer: answer.answer, fallback_level: fallbackLevel, citations: fallbackLevel < 3 ? citations : [], topic_covered: fallbackLevel < 3 });
      }

      const answer = await invokeLLM({
        model: QUALITY_MODEL,
        prompt: `You are an AI academic assistant. The student has not set up a semester yet, so no lecture context is available. Give a brief, helpful general response. Clearly note that you don't have access to their lecture content yet.\n\nStudent question: ${message}`,
      });

      res.json({ answer: typeof answer === 'string' ? answer : answer.answer || 'I could not process that request.', fallback_level: 3, citations: [], topic_covered: false });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

export default router;
