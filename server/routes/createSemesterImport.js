import express from 'express';
import { pool } from '../lib/db.js';
import { saveSemesterImport, validateSemesterImport, ClassNotInSemester } from '../lib/semesterImport.js';
import { SemesterNotFound } from '../lib/semesterDelete.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = express.Router();

// One endpoint, two shapes. Without `semester_id` this creates a new active
// semester (the first import). With it, the semester is updated in place —
// classes carrying an `id` are updated, the rest inserted, nothing deleted —
// so a corrected timetable never detaches a student's lectures.
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
    return res.status(input.semester_id ? 200 : 201).json(await saveSemesterImport(db, req.user.id, input));
  } catch (error) {
    if (error instanceof SemesterNotFound) return res.status(404).json({ error: 'Semester not found' });
    // The review screen referred to a class that is no longer in the semester
    // (deleted in another tab). Nothing was written; the screen should reload.
    if (error instanceof ClassNotInSemester) return res.status(409).json({ error: error.message });
    console.error('[create-semester-import]', error);
    return res.status(500).json({ error: 'Could not save the semester. No changes were made.' });
  } finally {
    db.release();
  }
});

export default router;
