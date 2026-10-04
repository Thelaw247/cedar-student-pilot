import { formatShortDate } from './time.js';

/**
 * What a lecture is called wherever it is listed.
 *
 * Its own title once the recording has been read; until then (recording,
 * uploading, still processing) "Lecture on Sep 27", so a row is never blank
 * and never shows the raw "2026-09-27". Eleven screens each had their own
 * copy of this fallback, spelled three different ways; this is the one copy.
 */
export function lectureTitle(lecture) {
  if (!lecture) return 'Lecture';
  const title = typeof lecture.ai_title === 'string' ? lecture.ai_title.trim() : '';
  if (title) return title;
  const date = formatShortDate(lecture.date);
  return date ? `Lecture on ${date}` : 'Lecture';
}
