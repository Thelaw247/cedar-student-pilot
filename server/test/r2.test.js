import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertOwnedKey,
  parseStorageRef,
  recordingKey,
  validateRecordingUpload,
} from '../lib/r2.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';

test('validates recording MIME type and size', () => {
  assert.deepEqual(
    validateRecordingUpload({ contentType: 'audio/webm;codecs=opus', sizeBytes: 1024 }),
    { contentType: 'audio/webm', sizeBytes: 1024 },
  );
  assert.throws(
    () => validateRecordingUpload({ contentType: 'text/html', sizeBytes: 10 }),
    /Unsupported/,
  );
  assert.throws(
    () => validateRecordingUpload({ contentType: 'audio/webm', sizeBytes: 201 * 1024 * 1024 }),
    /200 MB/,
  );
});

test('generates opaque user-scoped recording keys', () => {
  const key = recordingKey(USER_ID, 'audio/webm');
  assert.match(key, new RegExp(`^users/${USER_ID}/recordings/[0-9a-f-]+\\.webm$`));
  assert.equal(assertOwnedKey(USER_ID, key), key);
});

test('rejects cross-user and traversal keys', () => {
  assert.throws(
    () => assertOwnedKey(USER_ID, 'users/22222222-2222-4222-8222-222222222222/recordings/a.webm'),
    /Invalid storage key/,
  );
  assert.throws(
    () => assertOwnedKey(USER_ID, `users/${USER_ID}/../secret`),
    /Invalid storage key/,
  );
});

test('parses stable R2 storage references', () => {
  assert.deepEqual(parseStorageRef('r2://cedar-recordings/users/u/file.webm'), {
    bucket: 'cedar-recordings',
    key: 'users/u/file.webm',
  });
  assert.equal(parseStorageRef('https://example.com/file'), null);
});
