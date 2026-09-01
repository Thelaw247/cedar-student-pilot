import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * The lecture status vocabulary is shared by three things that cannot import
 * each other: the Postgres CHECK constraint, the Express route, and the React
 * recording client. They drifted once — the client polled for 'completed',
 * which the constraint forbids, so the success branch was unreachable. Every
 * save looked hung, and every retry created a duplicate lecture and charged
 * the student again. These assertions are the seam that catches the next one.
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

function schemaStatuses() {
  const sql = read('supabase/schema_snapshot.sql');
  const line = sql.split('\n').find((l) => l.includes('lectures_status_check'));
  assert.ok(line, 'lectures_status_check is missing from the schema snapshot');
  return [...line.matchAll(/'([a-z]+)'::text/g)].map((m) => m[1]).sort();
}

test('the client status constants match the database CHECK constraint', () => {
  const client = read('shared/lectureStatus.js');
  const declared = [...client.matchAll(/^export const LECTURE_[A-Z]+ = '([a-z]+)';$/gm)].map((m) => m[1]).sort();
  assert.deepEqual(declared, schemaStatuses());
});

test('every lecture status the server writes is one the database allows', () => {
  const route = read('server/routes/processLectureRecording.js');
  const allowed = new Set(schemaStatuses());
  const written = [...route.matchAll(/set status\s*=\s*'([a-z]+)'/g)].map((m) => m[1]);
  assert.ok(written.length > 0, 'expected the route to set lecture status');
  for (const status of written) {
    assert.ok(allowed.has(status), `route writes lecture status '${status}', which the schema rejects`);
  }
});

test('the recording client compares status against the shared constants, not string literals', () => {
  const ctx = read('src/recording/RecordingContext.jsx');
  const compared = [...ctx.matchAll(/lecture\?\.status === ([A-Za-z_'"]+)/g)].map((m) => m[1]);
  assert.ok(compared.length > 0, 'expected the poll to compare lecture status');
  for (const token of compared) {
    assert.ok(
      token.startsWith('LECTURE_'),
      `poll compares status against ${token}; use a constant from shared/lectureStatus.js`,
    );
  }
});
