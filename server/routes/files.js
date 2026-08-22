import express from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  confirmRecordingUpload,
  confirmAvatarUpload,
  createAvatarUpload,
  createDownloadUrl,
  createRecordingUpload,
  deleteOwnedObject,
} from '../lib/r2.js';

const router = express.Router();

function clientError(error, res) {
  if (error instanceof TypeError) return res.status(400).json({ error: error.message });
  if (error instanceof RangeError) return res.status(413).json({ error: error.message });
  console.error('[files]', error);
  return res.status(500).json({ error: 'File storage request failed' });
}

router.post('/recordings/upload-url', requireAuth, async (req, res) => {
  try {
    const result = await createRecordingUpload(req.user.id, {
      contentType: req.body?.content_type,
      sizeBytes: req.body?.size_bytes,
    });
    res.json(result);
  } catch (error) {
    clientError(error, res);
  }
});

router.post('/avatars/upload-url', requireAuth, async (req, res) => {
  try {
    res.json(await createAvatarUpload(req.user.id, {
      contentType: req.body?.content_type,
      sizeBytes: req.body?.size_bytes,
    }));
  } catch (error) {
    clientError(error, res);
  }
});

router.post('/avatars/confirm', requireAuth, async (req, res) => {
  try {
    res.json(await confirmAvatarUpload(req.user.id, req.body?.key));
  } catch (error) {
    clientError(error, res);
  }
});

router.post('/recordings/confirm', requireAuth, async (req, res) => {
  try {
    res.json(await confirmRecordingUpload(req.user.id, req.body?.key));
  } catch (error) {
    clientError(error, res);
  }
});

router.get('/download-url', requireAuth, async (req, res) => {
  try {
    res.json(await createDownloadUrl(req.user.id, req.query?.key));
  } catch (error) {
    clientError(error, res);
  }
});

router.delete('/', requireAuth, async (req, res) => {
  try {
    await deleteOwnedObject(req.user.id, req.body?.key);
    res.sendStatus(204);
  } catch (error) {
    clientError(error, res);
  }
});

export default router;
