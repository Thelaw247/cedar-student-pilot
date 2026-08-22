import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTimetableDataUrl } from '../lib/timetableFile.js';

test('accepts an allowed inline timetable file', () => {
  const result = parseTimetableDataUrl('data:image/png;base64,aGVsbG8=');
  assert.equal(result.mimeType, 'image/png');
  assert.equal(result.buffer.toString(), 'hello');
});

test('rejects remote URLs so the parser cannot be used for SSRF', () => {
  assert.throws(
    () => parseTimetableDataUrl('http://169.254.169.254/latest/meta-data'),
    /inline file upload/,
  );
});

test('rejects executable and malformed inline inputs', () => {
  assert.throws(
    () => parseTimetableDataUrl('data:text/html;base64,PGgxPmhpPC9oMT4='),
    /PDF, JPEG, PNG, or WebP/,
  );
  assert.throws(
    () => parseTimetableDataUrl('data:image/png;base64,%%%'),
    /valid base64/,
  );
});

