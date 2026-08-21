import express from 'express';
import crypto from 'node:crypto';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { invokeLLM, createLlmUsage } from '../lib/llm.js';
import { gateFeature, settleFeature } from '../lib/credits.js';

// Direct port of base44/functions/generateClassHandbook/entry.ts. See that
// file's preserved header comment for the three real bugs this fixed
// (cost, caching, N+1 queries). All three fixes carry over unchanged — this
// is a transport/query-shape port, not a redesign.

const router = express.Router();
const EXPANSION_CAP = 6;
const TRANSCRIPT_EXCERPT_CHARS = 3000;

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 32);
}

function sourceFingerprint(lectures) {
  return lectures.map((l) => [
    l.id, l.ai_title || '', (l.ai_summary || '').length, (l.transcript || '').length,
    (l.ai_concepts || []).length, (l.ai_definitions || []).length, (l.ai_vocabulary || []).length, (l.ai_formulas || []).length,
  ].join(':')).join('|');
}

router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { class_id, lecture_ids, assignment_id } = req.body || {};
    if (!class_id) return res.status(400).json({ error: 'class_id is required' });

    const cls = (await pool.query('select * from classes where id = $1 and user_id = $2', [class_id, userId])).rows[0] || null;

    const allForClass = (await pool.query('select * from lectures where class_id = $1 and user_id = $2 order by date desc', [class_id, userId])).rows;

    let lectures = allForClass;
    if (lecture_ids && lecture_ids.length > 0) {
      const wanted = new Set(lecture_ids);
      lectures = allForClass.filter((l) => wanted.has(l.id));
    }

    let scopeLabel = 'Full Class';
    if (assignment_id) {
      const asgn = (await pool.query('select * from assignments where id = $1 and user_id = $2', [assignment_id, userId])).rows[0];
      if (asgn) {
        scopeLabel = asgn.title || 'Exam Scope';
        if (asgn.coverage_scope === 'since_last' && lectures.length > 0) {
          const allAssignments = (await pool.query('select * from assignments where class_id = $1 and user_id = $2 order by due_date', [class_id, userId])).rows;
          const prior = allAssignments.filter((a) => a.due_date < asgn.due_date).sort((a, b) => b.due_date.localeCompare(a.due_date));
          if (prior.length > 0) {
            const lastExamDate = prior[0].due_date;
            lectures = lectures.filter((l) => l.date >= lastExamDate && l.date <= asgn.due_date);
          }
        }
      }
    }

    const hasContent = (l) => l.ai_summary || l.transcript || (l.ai_concepts || []).length > 0;
    const lecturesWithContent = lectures.filter(hasContent).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const excludedCount = lectures.length - lecturesWithContent.length;

    if (lecturesWithContent.length === 0) {
      return res.json({
        title: cls?.name || 'Class Handbook', instructor: cls?.instructor || '', scope_label: scopeLabel,
        table_of_contents: [], chapters: [], total_lectures: 0, lectures_in_scope: lectures.length, lectures_excluded: excludedCount,
        message: lectures.length > 0
          ? `${lectures.length} lecture${lectures.length === 1 ? '' : 's'} in this class have not been processed yet. Process them to build the handbook.`
          : 'No lecture content available yet. Record and process lectures first.',
      });
    }

    const scopeKey = assignment_id ? `assignment:${assignment_id}` : (lecture_ids && lecture_ids.length > 0) ? `lectures:${[...lecture_ids].sort().join(',')}` : 'full';
    const sourceHash = sha256(sourceFingerprint(lecturesWithContent));

    const cachedRows = (await pool.query('select * from handbooks where class_id = $1 and scope_key = $2 and user_id = $3', [class_id, scopeKey, userId])).rows;
    const hit = cachedRows.find((h) => h.source_hash === sourceHash);
    if (hit?.payload) return res.json({ ...JSON.parse(hit.payload), cached: true });

    const gate = await gateFeature(userId, 'handbook', res);
    if (!gate.ok) return;
    const llmUsage = createLlmUsage();

    const notesByLecture = {};
    const allNotes = (await pool.query('select * from notes where class_id = $1 and user_id = $2', [class_id, userId])).rows;
    for (const n of allNotes) {
      if (!n.lecture_id || !n.content) continue;
      notesByLecture[n.lecture_id] = notesByLecture[n.lecture_id] ? `${notesByLecture[n.lecture_id]}\n\n${n.content}` : n.content;
    }

    const chapters = lecturesWithContent.map((lec, idx) => ({
      chapter_number: idx + 1, title: lec.ai_title || `Lecture — ${lec.date}`, lecture_id: lec.id, lecture_date: lec.date,
      summary: lec.ai_summary || '', concepts: lec.ai_concepts || [], definitions: lec.ai_definitions || [],
      formulas: lec.ai_formulas || [], vocabulary: lec.ai_vocabulary || [], action_items: lec.ai_action_items || [],
      exam_mentions: lec.ai_exam_mentions || [], notes: notesByLecture[lec.id] || '',
      transcript_excerpt: (lec.transcript || '').substring(0, TRANSCRIPT_EXCERPT_CHARS),
      transcript_length: (lec.transcript || '').length, ai_expansion: '',
    }));

    const isThin = (ch) => { const conceptCount = (ch.concepts || []).length + (ch.definitions || []).length; return ch.transcript_length < 800 || conceptCount <= 2; };
    const thin = chapters.filter(isThin).slice(0, EXPANSION_CAP);

    await Promise.all(thin.map(async (ch) => {
      try {
        const result = await invokeLLM({
          usage: llmUsage,
          prompt: `You are helping a university student study "${cls?.name || 'a class'}". Below is what was captured from one lecture. Parts of it look thinly covered — either the recording was short or some topics were only mentioned in passing.

Your job: briefly fill in ONLY the clear gaps in the topics that were ALREADY introduced in this lecture. This is supplementary context to make the student's notes usable — not a rewrite.

Strict rules:
- Only expand on concepts, terms, or topics that already appear below. Do NOT introduce new topics the lecture didn't touch.
- Keep it short: at most 2-3 tight paragraphs, or a few bullet-style sentences. Fill gaps, don't pad.
- Write it as neutral, standard explanation. Do NOT imitate or invent the professor's wording or claim the professor said something they didn't.
- If the material below is already adequately covered and needs no filling in, return an empty string.

Lecture title: ${ch.title}
Summary: ${ch.summary || '(none)'}
Concepts: ${(ch.concepts || []).join(', ') || '(none)'}
Definitions: ${(ch.definitions || []).map((d) => d.term).join(', ') || '(none)'}
Transcript excerpt: ${ch.transcript_excerpt || '(none)'}

Return ONLY the supplementary explanation text (or an empty string if none is needed). No preamble.`,
        });
        const expansion = typeof result === 'string' ? result : (result?.text || '');
        if (expansion && expansion.trim().length > 0) ch.ai_expansion = expansion.trim();
      } catch (e) { /* non-fatal: chapter simply gets no expansion */ }
    }));

    const table_of_contents = chapters.map((ch) => ({
      chapter: ch.chapter_number, title: ch.title, lecture_id: ch.lecture_id, date: ch.lecture_date,
      has_expansion: !!ch.ai_expansion,
      section_count: [ch.summary, ch.concepts?.length, ch.definitions?.length, ch.formulas?.length, ch.vocabulary?.length, ch.action_items?.length, ch.exam_mentions?.length, ch.notes].filter(Boolean).length,
    }));

    const payload = {
      title: cls?.name || 'Class Handbook', instructor: cls?.instructor || '', class_color: cls?.color || '#3B82F6',
      scope_label: scopeLabel, is_scoped: !!(lecture_ids && lecture_ids.length > 0) || !!assignment_id,
      total_lectures: lecturesWithContent.length, lectures_in_scope: lectures.length, lectures_excluded: excludedCount,
      generated_at: new Date().toISOString(), table_of_contents, chapters,
    };

    try {
      const serialized = JSON.stringify(payload);
      const existing = (await pool.query('select id from handbooks where user_id = $1 and class_id = $2 and scope_key = $3', [userId, class_id, scopeKey])).rows;
      if (existing.length > 0) {
        await pool.query('update handbooks set source_hash = $1, payload = $2, total_lectures = $3, generated_at = $4 where id = $5',
          [sourceHash, serialized, payload.total_lectures, payload.generated_at, existing[0].id]);
        for (const dup of existing.slice(1)) await pool.query('delete from handbooks where id = $1', [dup.id]);
      } else {
        await pool.query('insert into handbooks (user_id, class_id, scope_key, source_hash, payload, total_lectures, generated_at) values ($1,$2,$3,$4,$5,$6,$7)',
          [userId, class_id, scopeKey, sourceHash, serialized, payload.total_lectures, payload.generated_at]);
      }
    } catch (e) {
      console.error('[handbook] cache write failed', e.message);
    }

    await settleFeature(gate, { feature: 'handbook', llmUsage });
    res.json({ ...payload, cached: false });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
