import { triggerRoute } from './triggerRoute.js';

try {
  const result = await triggerRoute('/grant-monthly-credits', 'GRANT_TRIGGER_TOKEN');
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
