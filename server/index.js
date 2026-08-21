import express from 'express';
import stripeWebhookRouter from './routes/stripeWebhook.js';
import meRouter from './routes/me.js';
import exportUserDataRouter from './routes/exportUserData.js';
import deleteUserDataRouter from './routes/deleteUserData.js';
import resolveAssignmentRouter from './routes/resolveAssignment.js';
import searchLecturesRouter from './routes/searchLectures.js';
import parseTimetableUploadRouter from './routes/parseTimetableUpload.js';

const app = express();
const PORT = process.env.PORT || 3000;

// MUST be mounted with express.raw(), before any express.json() middleware
// on this path — Stripe signature verification needs the exact raw request
// bytes.
app.use('/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookRouter);

// Every route below this line gets parsed JSON bodies.
app.use(express.json({ limit: '10mb' }));

app.use('/me', meRouter);
app.use('/export-user-data', exportUserDataRouter);
app.use('/delete-user-data', deleteUserDataRouter);
app.use('/resolve-assignment', resolveAssignmentRouter);
app.use('/search-lectures', searchLecturesRouter);
app.use('/parse-timetable-upload', parseTimetableUploadRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'cedar-server', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`cedar-server listening on port ${PORT}`);
});
