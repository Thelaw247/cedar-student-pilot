const MAX_TIMETABLE_BYTES = 8 * 1024 * 1024;
const ALLOWED_TIMETABLE_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

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
    throw new RangeError('Timetable files must be 8 MB or smaller');
  }
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > MAX_TIMETABLE_BYTES) {
    throw new RangeError('Timetable files must be non-empty and 8 MB or smaller');
  }
  // Buffer.from is permissive. Re-encoding catches malformed/truncated base64
  // rather than forwarding ambiguous bytes to the model provider.
  const canonicalInput = match[2].replace(/=+$/, '');
  if (buffer.toString('base64').replace(/=+$/, '') !== canonicalInput) {
    throw new TypeError('Timetable upload contains invalid base64 data');
  }
  return { mimeType, buffer };
}

