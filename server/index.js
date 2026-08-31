import express from 'express';
import { fileURLToPath } from 'node:url';
import { pool } from './lib/db.js';
import { requestSecurity } from './lib/http.js';
import { creditSignal } from './lib/creditSignal.js';
import { logStripeBootStatus } from './lib/stripeBootCheck.js';
import { canDeleteAuthUsers } from './lib/accountDeletion.js';
import { logSchedulerStatus } from './lib/schedulerCheck.js';
import { checkR2Connection } from './lib/r2.js';
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
import trackEventRouter from './routes/trackEvent.js';
import exportTranscriptRouter from './routes/exportTranscript.js';
import processLectureRecordingRouter from './routes/processLectureRecording.js';
import academicAIChatRouter from './routes/academicAIChat.js';
import sendStudyRemindersRouter from './routes/sendStudyReminders.js';
import filesRouter from './routes/files.js';
import deleteAcademicDataRouter from './routes/deleteAcademicData.js';
import createSemesterImportRouter from './routes/createSemesterImport.js';

export const app = express();
const PORT = process.env.PORT || 3000;
// Render injects RENDER_SERVICE_NAME, so staging reports itself as
// cedar-api-staging in health responses instead of the package name.
const SERVICE_NAME = String(process.env.RENDER_SERVICE_NAME || '').trim() || 'cedar-server';

app.disable('x-powered-by');
app.use(requestSecurity);

app.use('/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookRouter);

app.use(express.json({ limit: '10mb' }));

// Stamps X-Credits-Spent on any response whose handler actually charged, so
// the client's credit meter refreshes immediately rather than going stale
// until the next reload. Must sit above the routers and below the Stripe
// webhook's raw body. See server/lib/creditSignal.js.
app.use(creditSignal);

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
app.use('/track-event', trackEventRouter);
app.use('/export-transcript', exportTranscriptRouter);
app.use('/process-lecture-recording', processLectureRecordingRouter);
app.use('/academic-ai-chat', academicAIChatRouter);
app.use('/send-study-reminders', sendStudyRemindersRouter);
app.use('/files', filesRouter);
app.use('/data', deleteAcademicDataRouter);
app.use('/create-semester-import', createSemesterImportRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: SERVICE_NAME, timestamp: new Date().toISOString() });
});

// Readiness is deliberately separate from liveness: Render can keep using
// /health to decide whether the process is alive, while staging verification
// can prove that the configured Postgres credentials actually work.
app.get('/health/ready', async (req, res) => {
  const [database, storage] = await Promise.allSettled([
    pool.query({ text: 'select 1', query_timeout: 5_000 }),
    checkR2Connection(),
  ]);
  const checks = {
    database: database.status === 'fulfilled' ? 'ok' : 'error',
    storage: storage.status === 'fulfilled' ? 'ok' : 'error',
  };
  if (database.status === 'rejected') {
    console.error('[health] database readiness check failed', database.reason?.message);
  }
  if (storage.status === 'rejected') {
    console.error('[health] storage readiness check failed', storage.reason?.message);
  }
  const ready = Object.values(checks).every((status) => status === 'ok');
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'unavailable',
    service: SERVICE_NAME,
    checks,
    timestamp: new Date().toISOString(),
  });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`${SERVICE_NAME} listening on port ${PORT}`);
    // Non-fatal on purpose — see lib/stripeBootCheck.js. Logged after listen so
    // a misconfiguration can never stop the service binding its port.
    logStripeBootStatus();
    // Account deletion needs DELETE on auth.users, which only the postgres role
    // holds. Nothing surfaces a missing grant until someone tries to delete
    // their account — once — so ask at boot instead.
    // Both cron routes are behind a shared secret. Missing means 401 for any
    // scheduler pointed at them, which is a bad thing to discover by wiring one.
    logSchedulerStatus();
    canDeleteAuthUsers(pool)
      .then((s) => (s.ok ? console.log(`[boot] ${s.message}`) : console.error(`[boot] ${s.message}`)))
      .catch((e) => console.error(`[boot] account deletion: privilege check failed — ${e.message}`));
  });
}
