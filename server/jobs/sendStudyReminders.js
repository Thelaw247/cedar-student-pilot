import { triggerRoute } from './triggerRoute.js';

try {
  const result = await triggerRoute('/send-study-reminders', 'REMINDERS_TRIGGER_TOKEN');
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
