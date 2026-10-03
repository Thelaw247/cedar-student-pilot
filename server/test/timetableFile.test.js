import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTimetableDataUrl } from '../lib/timetableFile.js';

const PNG_START = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const dataUrl = (type, bytes) => `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;

test('accepts an allowed inline timetable file', () => {
  const result = parseTimetableDataUrl(dataUrl('image/png', PNG_START));
  assert.equal(result.mimeType, 'image/png');
  assert.deepEqual(result.buffer, PNG_START);
  assert.equal(parseTimetableDataUrl(dataUrl('application/pdf', '%PDF-1.7\n%...')).mimeType, 'application/pdf');
});

test('refuses a file whose bytes are not the type it claims', () => {
  // The declared type comes from the file name: a page renamed to .png, or
  // text saved as .pdf, used to go straight to the model provider.
  assert.throws(() => parseTimetableDataUrl('data:image/png;base64,aGVsbG8='), /not a real PNG image/);
  assert.throws(() => parseTimetableDataUrl(dataUrl('application/pdf', '<html><script>alert(1)</script>')), /not a real PDF/);
  assert.throws(() => parseTimetableDataUrl(dataUrl('image/jpeg', 'GIF89a')), /not a real JPEG image/);
});

test('an allowed file under the wrong name is taken as what it really is', () => {
  // A PNG screenshot saved as .jpg is still a fine screenshot.
  assert.equal(parseTimetableDataUrl(dataUrl('image/jpeg', PNG_START)).mimeType, 'image/png');
  assert.equal(parseTimetableDataUrl(dataUrl('application/pdf', PNG_START)).mimeType, 'image/png');
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

