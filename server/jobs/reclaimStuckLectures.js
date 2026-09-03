import { triggerRoute } from './triggerRoute.js';

// Releases lectures abandoned mid-processing (see routes/reclaimStuckLectures.js).
// Runs on the same daily schedule as the credit grant; nothing about it needs
// its own cadence, and one workflow is one thing to keep working.
try {
  const result = await triggerRoute('/reclaim-stuck-lectures', 'RECLAIM_TRIGGER_TOKEN');
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
