import express from 'express';
import { pool } from '../lib/db.js';
import { saveSemesterImport, validateSemesterImport } from '../lib/semesterImport.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  let input;
  try {
    input = validateSemesterImport(req.body);
  } catch (error) {
    const status = error instanceof RangeError ? 422 : 400;
    return res.status(status).json({ error: error.message });
  }

  const db = await pool.connect();
  try {
    return res.status(201).json(await saveSemesterImport(db, req.user.id, input));
  } catch (error) {
    console.error('[create-semester-import]', error);
    return res.status(500).json({ error: 'Could not save the semester. No changes were made.' });
  } finally {
    db.release();
  }
});

export default router;
