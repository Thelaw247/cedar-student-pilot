import express from 'express';
import { fileURLToPath } from 'node:url';
import { pool } from './lib/db.js';
import { requestSecurity } from './lib/http.js';
import stripeWebhookRouter from './routes/stripeWebhook.js';
import meRouter from './routes/me.js';
import exportUserDataRouter from './routes/exportUserData.js';
import deleteUserDataRouter from './routes/deleteUserData.js';
import resolveAssignmentRouter from './routes/resolveAssignment.js';
import searchLecturesRouter from './routes/searchLectures.js';
import parseTimetableUploadRouter from './routes/parseTimetableUpload.js';
import createCheckoutSessionRouter from './routes/createCheckoutSession.js';
import createPortalSessionRouter from './routes/createPortalSession.js';
import confirmCheckoutSessionRouter from './routes/confirmCheckoutSession.js';
import grantMonthlyCreditsRouter from './routes/grantMonthlyCredits.js';
import cleanLectureTranscriptRouter from './routes/cleanLectureTranscript.js';
import generateStudyMaterialRouter from './routes/generateStudyMaterial.js';
import predictExamTopicsRouter from './routes/predictExamTopics.js';
import generateStudyScheduleRouter from './routes/generateStudySchedule.js';
import verifyProvidersRouter from './routes/verifyProviders.js';
import detectAcademicRiskRouter from './routes/detectAcademicRisk.js';
import fitProjectTimeRouter from './routes/fitProjectTime.js';
import generateMissedLectureSummaryRouter from './routes/generateMissedLectureSummary.js';
import generateLectureReviewRouter from './routes/generateLectureReview.js';
import generateSessionReviewRouter from './routes/generateSessionReview.js';
import processSessionReviewRouter from './routes/processSessionReview.js';
import rebookStudySessionRouter from './routes/rebookStudySession.js';
import generateProjectRoadmapRouter from './routes/generateProjectRoadmap.js';
import generateClassHandbookRouter from './routes/generateClassHandbook.js';
import ownerAnalyticsRouter from './routes/ownerAnalytics.js';
import exportTranscriptRouter from './routes/exportTranscript.js';
import processLectureRecordingRouter from './routes/processLectureRecording.js';
import academicAIChatRouter from './routes/academicAIChat.js';
import sendStudyRemindersRouter from './routes/sendStudyReminders.js';
import filesRouter from './routes/files.js';
import deleteAcademicDataRouter from './routes/deleteAcademicData.js';

export const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.use(requestSecurity);

app.use('/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookRouter);

app.use(express.json({ limit: '10mb' }));

app.use('/me', meRouter);
app.use('/export-user-data', exportUserDataRouter);
app.use('/delete-user-data', deleteUserDataRouter);
app.use('/resolve-assignment', resolveAssignmentRouter);
app.use('/search-lectures', searchLecturesRouter);
app.use('/parse-timetable-upload', parseTimetableUploadRouter);
app.use('/create-checkout-session', createCheckoutSessionRouter);
app.use('/create-portal-session', createPortalSessionRouter);
app.use('/confirm-checkout-session', confirmCheckoutSessionRouter);
app.use('/grant-monthly-credits', grantMonthlyCreditsRouter);
app.use('/clean-lecture-transcript', cleanLectureTranscriptRouter);
app.use('/generate-study-material', generateStudyMaterialRouter);
app.use('/predict-exam-topics', predictExamTopicsRouter);
app.use('/generate-study-schedule', generateStudyScheduleRouter);
app.use('/verify-providers', verifyProvidersRouter);
app.use('/detect-academic-risk', detectAcademicRiskRouter);
app.use('/fit-project-time', fitProjectTimeRouter);
app.use('/generate-missed-lecture-summary', generateMissedLectureSummaryRouter);
app.use('/generate-lecture-review', generateLectureReviewRouter);
app.use('/generate-session-review', generateSessionReviewRouter);
app.use('/process-session-review', processSessionReviewRouter);
app.use('/rebook-study-session', rebookStudySessionRouter);
app.use('/generate-project-roadmap', generateProjectRoadmapRouter);
app.use('/generate-class-handbook', generateClassHandbookRouter);
app.use('/owner-analytics', ownerAnalyticsRouter);
app.use('/export-transcript', exportTranscriptRouter);
app.use('/process-lecture-recording', processLectureRecordingRouter);
app.use('/academic-ai-chat', academicAIChatRouter);
app.use('/send-study-reminders', sendStudyRemindersRouter);
app.use('/files', filesRouter);
app.use('/data', deleteAcademicDataRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'cedar-server', timestamp: new Date().toISOString() });
});

// Readiness is deliberately separate from liveness: Render can keep using
// /health to decide whether the process is alive, while staging verification
// can prove that the configured Postgres credentials actually work.
app.get('/health/ready', async (req, res) => {
  try {
    await pool.query({ text: 'select 1', query_timeout: 5_000 });
    res.json({
      status: 'ready',
      service: 'cedar-server',
      checks: { database: 'ok' },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[health] database readiness check failed', error.message);
    res.status(503).json({
      status: 'unavailable',
      service: 'cedar-server',
      checks: { database: 'error' },
      timestamp: new Date().toISOString(),
    });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`cedar-server listening on port ${PORT}`);
  });
}
