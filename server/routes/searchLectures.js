import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';

// Direct port of base44/functions/searchLectures/entry.ts.

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { query } = req.body || {};
    if (!query || query.trim().length < 2) return res.json({ results: [] });

    const searchTerm = query.toLowerCase().trim();
    const { rows: lectures } = await pool.query(
      'select * from lectures where user_id = $1 order by date desc limit 200', [userId]);

    const classIds = [...new Set(lectures.map((l) => l.class_id).filter(Boolean))];
    let classMap = {};
    if (classIds.length > 0) {
      const { rows: classes } = await pool.query(
        'select * from classes where user_id = $1 and id = any($2::uuid[])', [userId, classIds]);
      classMap = Object.fromEntries(classes.map((c) => [c.id, c]));
    }

    const results = [];
    for (const lec of lectures) {
      const className = classMap[lec.class_id]?.name || 'Unknown Class';
      const title = lec.ai_title || `Lecture on ${lec.date}`;
      const searchable = [
        { text: lec.transcript || '', type: 'transcript' },
        { text: lec.ai_summary || '', type: 'summary' },
        { text: (lec.ai_concepts || []).join(' '), type: 'concepts' },
        { text: (lec.ai_vocabulary || []).join(' '), type: 'vocabulary' },
      ];
      for (const { text, type } of searchable) {
        if (!text) continue;
        const lower = text.toLowerCase();
        const idx = lower.indexOf(searchTerm);
        if (idx !== -1) {
          const start = Math.max(0, idx - 60);
          const end = Math.min(text.length, idx + searchTerm.length + 60);
          const snippet = (start > 0 ? '...' : '') + text.substring(start, end) + (end < text.length ? '...' : '');
          results.push({ lecture_id: lec.id, class_id: lec.class_id, class_name: className, date: lec.date, title, snippet, match_type: type });
          break;
        }
      }
      if (results.length >= 20) break;
    }

    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
