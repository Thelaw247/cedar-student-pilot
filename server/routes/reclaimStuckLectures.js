import express from 'express';
import { pool } from '../lib/db.js';
import { LECTURE_PENDING, LECTURE_PROCESSING, PROCESSING_STALE_MINUTES } from '../../shared/lectureStatus.js';

/**
 * Hands abandoned lectures back so the student can retry them.
 *
 * processLectureRecording claims a lecture by flipping it to 'processing', and
 * releases it back to 'pending' from a catch block. That release only runs
 * in-process: if the API restarts, is redeployed, or is killed mid-run, the row
 * stays 'processing' forever. The lecture page then polls it indefinitely and
 * never shows the retry button, because retry is gated on 'pending' — so a
 * recording that finished uploading looks permanently stuck, with the audio
 * sitting safely in R2 and nothing willing to touch it.
 *
 * claimLecture already treats a row older than PROCESSING_STALE_MINUTES as
 * re-claimable, so the recovery rule exists; nothing ever applied it on its
 * own. This is that: a scheduled sweep that releases stale rows and writes the
 * reason the student sees.
 *
 * Same shared-secret gate as the other scheduled routes. Safe to run often and
 * safe to run twice: the update only matches rows still in 'processing' past
 * the window, so a second pass in the same minute changes nothing.
 */

const router = express.Router();

function tokensMatch(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// What the lecture page shows next to the retry button. It says what happened
// and that the audio is safe, because the student's first thought on seeing a
// failed lecture is that the recording is gone.
export const RECLAIM_REASON = 'Processing stopped unexpectedly — the server restarted before it finished. '
  + 'Your recording is safe. Press Process recording to pick it up again.';

router.post('/', async (req, res) => {
  try {
    const expected = process.env.RECLAIM_TRIGGER_TOKEN || process.env.GRANT_TRIGGER_TOKEN;
    const presented = req.headers['x-cedar-trigger-token'] || req.body?.trigger_token || '';
    if (!expected || !tokensMatch(String(expected), String(presented))) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { rows } = await pool.query(
      `update lectures
          set status = $1, processing_error = $2
        where status = $3
          and updated_at < now() - make_interval(mins => $4)
      returning id, user_id`,
      [LECTURE_PENDING, RECLAIM_REASON, LECTURE_PROCESSING, PROCESSING_STALE_MINUTES],
    );

    if (rows.length > 0) {
      console.warn(`[reclaim] released ${rows.length} stuck lecture(s):`, rows.map((r) => r.id).join(', '));
    }
    return res.json({ reclaimed: rows.length, stale_after_minutes: PROCESSING_STALE_MINUTES });
  } catch (error) {
    console.error('[reclaim]', error);
    return res.status(500).json({ error: 'Could not reclaim stuck lectures' });
  }
});

export default router;
