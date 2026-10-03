/**
 * What a file's first bytes say it is.
 *
 * Every upload path checks the type the browser declares against an
 * allowlist and the size against a cap, and stores the file under a name the
 * server picks, with an extension taken from the allowlisted type, in a
 * private bucket that never runs anything. What none of them checked was that
 * the bytes are what the type says: a page, a script or a program renamed to
 * timetable.pdf passed, because the declared type is only the browser's
 * reading of the file name. These checks read the content itself.
 *
 * Pure functions over a Buffer (or any byte array), so each upload path can
 * call them on whatever it already holds: the whole file for a timetable or
 * a material, the first bytes (SNIFF_BYTES) for a photo or a recording.
 */

/** Enough of a file's start for every signature below. */
export const SNIFF_BYTES = 1024;

const bytes = (data) => (Buffer.isBuffer(data) ? data : Buffer.from(data || []));
const ascii = (b, start, end) => b.toString('latin1', start, end);

// PDF readers accept the header anywhere in the first 1024 bytes (some
// generators put junk before it), so this does too.
const isPdf = (b) => b.subarray(0, SNIFF_BYTES).includes('%PDF-', 0, 'latin1');
const isJpeg = (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const isPng = (b) => b.length >= 8 && b.subarray(0, 8).equals(PNG_SIGNATURE);
const isWebp = (b) => b.length >= 12 && ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP';
// Text has no NUL bytes; anything binary almost always does. Deliberately not
// a strict UTF-8 check: a Windows-1252 handout with an accented name is
// still a handout, and it reads fine with the odd replaced character.
const isText = (b) => !b.subarray(0, 64 * 1024).includes(0);

const CONTENT_CHECKS = new Map([
  ['application/pdf', isPdf],
  ['image/jpeg', isJpeg],
  ['image/png', isPng],
  ['image/webp', isWebp],
  ['text/plain', isText],
  ['text/markdown', isText],
  ['text/x-markdown', isText],
]);

/**
 * True when the content is what `contentType` claims. False for a type this
 * module has no check for, so a caller cannot accept a type by accident.
 */
export function contentMatchesType(data, contentType) {
  const check = CONTENT_CHECKS.get(String(contentType || '').toLowerCase());
  return Boolean(check && check(bytes(data)));
}

/**
 * What a file is, read from its bytes: a PDF or one of the three image types,
 * or null. For the uploads that accept several of these, where the name can
 * be wrong in a harmless way (a PNG screenshot saved as .jpg is still a fine
 * screenshot), so the bytes decide which one it is.
 */
export function detectedType(data) {
  const b = bytes(data);
  if (isJpeg(b)) return 'image/jpeg';
  if (isPng(b)) return 'image/png';
  if (isWebp(b)) return 'image/webp';
  if (isPdf(b)) return 'application/pdf';
  return null;
}

// What a file must not be, whatever it is called. Each of these starts with
// bytes no audio container can start with: WebM, Ogg, WAV and MP3 begin with
// fixed magic, and an MP4 or M4A begins with the size of a box, which for
// any of these prefixes would be hundreds of megabytes, far over the 24 MB
// cap. So refusing them can never refuse a real recording.
const NOT_AUDIO = [
  { name: 'a web page or script', test: (b) => /^(\xef\xbb\xbf)?\s*</.test(ascii(b, 0, 64)) },
  { name: 'a script', test: (b) => ascii(b, 0, 2) === '#!' },
  { name: 'a PDF', test: (b) => ascii(b, 0, 5) === '%PDF-' },
  { name: 'an archive', test: (b) => ascii(b, 0, 4) === 'PK\x03\x04' },
  { name: 'a program', test: (b) => ascii(b, 0, 2) === 'MZ' || ascii(b, 0, 4) === '\x7fELF' },
];

/**
 * Why a "recording" is plainly not one, or null.
 *
 * Recordings get a denylist rather than the strict check above because the
 * cost of a wrong answer is so uneven: a lecture refused at upload is a
 * lecture lost, while anything that slips through only ever reaches the
 * transcription provider, which reads the format from the content and fails
 * on what is not audio. They are never served to anyone but their owner.
 */
export function notAudioReason(data) {
  const b = bytes(data);
  return NOT_AUDIO.find((kind) => kind.test(b))?.name || null;
}
