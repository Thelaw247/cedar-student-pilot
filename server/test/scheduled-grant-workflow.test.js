import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * The monthly grant runs from GitHub Actions because no Render cron was ever
 * provisioned. This pins the three things that would silently break it: the
 * route path, the header the route reads, and the secret name a human has to
 * create — a typo in any of them is a 401 nobody sees until month two.
 */
const wf = fs.readFileSync(new URL('../../.github/workflows/scheduled-credit-grant.yml', import.meta.url), 'utf8');
const route = fs.readFileSync(new URL('../routes/grantMonthlyCredits.js', import.meta.url), 'utf8');

test('the workflow posts to the grant route with the header the route checks', () => {
  assert.match(wf, /POST https:\/\/api\.praelecta\.ca\/grant-monthly-credits/);
  const header = route.match(/req\.headers\['([a-z-]+)'\]/)?.[1];
  assert.ok(header, 'route header not found');
  assert.ok(wf.includes(`-H "${header}: $TOKEN"`), `workflow must send ${header}`);
  assert.match(wf, /secrets\.GRANT_TRIGGER_TOKEN/);
});

test('it runs daily and can be triggered by hand', () => {
  assert.match(wf, /cron: "15 6 \* \* \*"/);
  assert.match(wf, /workflow_dispatch/);
});
