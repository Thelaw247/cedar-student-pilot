import { detectedType } from './fileSignature.js';

// Base64 expands by ~4/3 and this travels inside Express's 10 MB JSON limit.
// Seven binary MB leaves room for JSON framing without a misleading upload
// that the parser itself would accept but the HTTP layer would reject.
const MAX_TIMETABLE_BYTES = 7 * 1024 * 1024;
const ALLOWED_TIMETABLE_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const TYPE_NAMES = {
  'application/pdf': 'PDF',
  'image/jpeg': 'JPEG image',
  'image/png': 'PNG image',
  'image/webp': 'WebP image',
};

export function parseTimetableDataUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('data:')) {
    throw new TypeError('Timetable input must be an inline file upload');
  }
  const match = /^data:([^;,]+);base64,([a-z0-9+/=]+)$/i.exec(value);
  if (!match) throw new TypeError('Timetable upload is not a valid base64 data URL');
  const mimeType = match[1].toLowerCase();
  if (!ALLOWED_TIMETABLE_TYPES.has(mimeType)) {
    throw new TypeError('Timetable must be a PDF, JPEG, PNG, or WebP file');
  }
  // Reject oversized encoded input before allocating the decoded Buffer.
  if (match[2].length > Math.ceil(MAX_TIMETABLE_BYTES / 3) * 4 + 4) {
    throw new RangeError('Timetable files must be 7 MB or smaller');
  }
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > MAX_TIMETABLE_BYTES) {
    throw new RangeError('Timetable files must be non-empty and 7 MB or smaller');
  }
  // Buffer.from is permissive. Re-encoding catches malformed/truncated base64
  // rather than forwarding ambiguous bytes to the model provider.
  const canonicalInput = match[2].replace(/=+$/, '');
  if (buffer.toString('base64').replace(/=+$/, '') !== canonicalInput) {
    throw new TypeError('Timetable upload contains invalid base64 data');
  }
  // The declared type is only the browser's reading of the file name. The
  // bytes decide, before anything is sent to the model provider: one of the
  // allowed types under the wrong name (a PNG saved as .jpg) is accepted as
  // what it really is; anything else is refused.
  const actualType = detectedType(buffer);
  if (!ALLOWED_TIMETABLE_TYPES.has(actualType)) {
    throw new TypeError(`This file is not a real ${TYPE_NAMES[mimeType]}. Save your timetable as a PDF or a screenshot (JPEG, PNG or WebP) and upload that.`);
  }
  return { mimeType: actualType, buffer };
}
