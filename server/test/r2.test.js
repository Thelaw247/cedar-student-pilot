import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertOwnedKey,
  avatarKey,
  createAvatarUpload,
  createRecordingUpload,
  parseStorageRef,
  recordingKey,
  r2IsConfigured,
  validateRecordingUpload,
  validateAvatarUpload,
} from '../lib/r2.js';

const USER_ID = '11111111-1111-4111-8111-111111111111';

test('normalizes copied R2 environment values', () => {
  const names = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    for (const name of names) process.env[name] = '  configured-value\n';
    assert.equal(r2IsConfigured(), true);
    process.env.R2_ACCESS_KEY_ID = ' \n ';
    assert.equal(r2IsConfigured(), false);
  } finally {
    for (const name of names) {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    }
  }
});

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
    () => validateRecordingUpload({ contentType: 'audio/webm', sizeBytes: 25 * 1024 * 1024 }),
    /24 MB/,
  );
  assert.deepEqual(
    validateRecordingUpload({ contentType: 'audio/webm', sizeBytes: 24 * 1024 * 1024 }),
    { contentType: 'audio/webm', sizeBytes: 24 * 1024 * 1024 },
  );
});

test('validates profile photos and generates an isolated avatar key', () => {
  assert.deepEqual(validateAvatarUpload({ contentType: 'image/png', sizeBytes: 512 }), {
    contentType: 'image/png', sizeBytes: 512,
  });
  assert.match(avatarKey(USER_ID, 'image/png'), new RegExp(`^users/${USER_ID}/avatars/[0-9a-f-]+\\.png$`));
  assert.throws(() => validateAvatarUpload({ contentType: 'image/svg+xml', sizeBytes: 512 }), /JPEG/);
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

test('accepts only the exact user prefix for bulk cleanup', () => {
  assert.equal(assertOwnedKey(USER_ID, `users/${USER_ID}/`), `users/${USER_ID}/`);
  assert.throws(
    () => assertOwnedKey(USER_ID, 'users/'),
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

test('presigned browser uploads sign metadata headers and carry no SDK checksum requirement', async () => {
  // AWS SDK >= 3.729 adds x-amz-checksum-crc32 (of the empty placeholder body)
  // to presigned PutObject URLs unless checksum calculation is WHEN_REQUIRED.
  // R2 then rejects the browser's real upload and omits CORS headers on the
  // error, which surfaces as a misleading CORS failure in the app.
  const names = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
  const original = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  try {
    process.env.R2_ACCOUNT_ID = 'testaccount';
    process.env.R2_ACCESS_KEY_ID = 'test-access-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key';
    process.env.R2_BUCKET_NAME = 'test-bucket';
    const uploads = [
      await createAvatarUpload(USER_ID, { contentType: 'image/png', sizeBytes: 1024 }),
      await createRecordingUpload(USER_ID, { contentType: 'audio/webm', sizeBytes: 1024 }),
    ];
    for (const upload of uploads) {
      const url = new URL(upload.upload_url);
      const checksumParams = [...url.searchParams.keys()].filter((key) => key.toLowerCase().includes('checksum'));
      assert.deepEqual(checksumParams, []);
      assert.equal(url.host, 'test-bucket.testaccount.r2.cloudflarestorage.com');
      // Every x-amz-* header the browser sends must be signed, and none may be
      // hoisted into the query string, or R2 answers 403 SignatureDoesNotMatch.
      const signedHeaders = decodeURIComponent(url.searchParams.get('X-Amz-SignedHeaders')).split(';');
      const browserAmzHeaders = Object.keys(upload.headers).filter((name) => name.toLowerCase().startsWith('x-amz-'));
      assert.ok(browserAmzHeaders.length >= 3);
      for (const name of browserAmzHeaders) assert.ok(signedHeaders.includes(name.toLowerCase()), `${name} must be signed`);
      assert.deepEqual([...url.searchParams.keys()].filter((key) => key.toLowerCase().startsWith('x-amz-meta')), []);
    }
  } finally {
    for (const name of names) {
      if (original[name] === undefined) delete process.env[name];
      else process.env[name] = original[name];
    }
  }
});
