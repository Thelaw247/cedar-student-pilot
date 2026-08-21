import express from 'express';
import { requireAuth } from '../middleware/requireAuth.js';

// Proves the auth middleware works end to end. Mirrors what any real ported
// function does first: verify who's calling, then act on their behalf.
// Nothing else should be built against requireAuth until this passes for
// real, the same standard every other piece of this migration has been held to.

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email });
});

export default router;
