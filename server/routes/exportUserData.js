import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';

// Direct port of base44/functions/exportUserData/entry.ts. Every query below
// is explicitly scoped by user_id — this server's DB connection bypasses
// Postgres RLS entirely (see server/lib/db.js), so the WHERE clause IS the
// only thing preventing this from exporting someone else's data.

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rows: semesters } = await pool.query(
      'select * from semesters where user_id = $1 and is_active = true', [userId]);
    if (semesters.length === 0) return res.status(400).json({ error: 'No active semester found' });
    const semester = semesters[0];

    const { rows: classes } = await pool.query(
      'select * from classes where user_id = $1 and semester_id = $2', [userId, semester.id]);

    const exportData = {
      exported_at: new Date().toISOString(), semester, classes: [], lectures: [], notes: [],
      study_records: [], study_sessions: [], calendar_events: [],
    };

    for (const cls of classes) {
      const { rows: lectures } = await pool.query(
        'select * from lectures where user_id = $1 and class_id = $2', [userId, cls.id]);
      exportData.lectures.push(...lectures);
      const { rows: assignments } = await pool.query(
        'select * from assignments where user_id = $1 and class_id = $2', [userId, cls.id]);
      for (const a of assignments) a._class_name = cls.name;
      exportData.classes.push({ ...cls, _assignments: assignments });
      const { rows: notes } = await pool.query(
        'select * from notes where user_id = $1 and class_id = $2', [userId, cls.id]);
      exportData.notes.push(...notes);
    }

    exportData.study_records = (await pool.query('select * from study_records where user_id = $1', [userId])).rows;
    exportData.study_sessions = (await pool.query('select * from study_sessions where user_id = $1', [userId])).rows;
    exportData.calendar_events = (await pool.query('select * from calendar_events where user_id = $1', [userId])).rows;

    const jsonStr = JSON.stringify(exportData, null, 2);
    res.set('Content-Type', 'application/json');
    res.set('Content-Disposition', `attachment; filename=cedar-export-${new Date().toISOString().split('T')[0]}.json`);
    res.status(200).send(jsonStr);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
