/**
 * Bounds what the analysis pass is allowed to write into a lecture row.
 *
 * On 3 Sep a lecture came back with a 252,075-character ai_title: the
 * stitched-summary call ("give the lecture one concise descriptive title")
 * fell into a repetition loop and emitted the same clause hundreds of times,
 * and the pipeline wrote it straight to the database. A normal title here is
 * 60-90 characters. Nothing between the model and the column looked at what it
 * was storing, so the lecture page tried to render four pages of a repeating
 * sentence as a heading.
 *
 * A response_json_schema of `{ title: { type: 'string' } }` constrains the
 * SHAPE and says nothing about the size, so a degenerate generation is
 * schema-valid. That is what this module is for: every short text field the
 * model produces passes through here before it is persisted.
 *
 * Two independent defences, because they fail differently:
 *   - collapseRepetition catches the loop itself, and keeps the good first
 *     iteration rather than an arbitrary prefix of a repeated phrase.
 *   - the length caps catch anything else that runs long, including a loop
 *     whose period is longer than we scan for.
 */

// Generous next to real values (titles run 60-90 chars, summaries 2-7k), tight
// enough that nothing pathological reaches a column or a page.
export const MAX_TITLE_CHARS = 200;
export const MAX_SUMMARY_CHARS = 20_000;
export const MAX_ITEM_CHARS = 500;
export const MAX_LIST_ITEMS = 60;

// How many word-periods to test when looking for a loop. A degenerate title
// repeats a clause, not a paragraph; beyond this the length cap takes over.
const MAX_PERIOD_WORDS = 60;

/**
 * If `text` is one phrase repeated, return a single clean iteration of it.
 *
 * Finds the shortest word-period p such that the text is that block repeated
 * (allowing the tail to be cut off mid-block, which is what a truncated
 * generation looks like). Requires the repeat to be genuinely established —
 * at least two further matching blocks — so ordinary repetition inside real
 * prose ("the the") is never mistaken for a loop.
 */
export function collapseRepetition(text) {
  if (typeof text !== 'string') return '';
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length < 6) return text.trim();

  const limit = Math.min(MAX_PERIOD_WORDS, Math.floor(words.length / 3));
  for (let p = 1; p <= limit; p++) {
    let i = 0;
    while (i + p < words.length && words[i].toLowerCase() === words[i + p].toLowerCase()) i++;
    // i is how far the sequence agrees with itself shifted by p. Two extra
    // full blocks (3 total) is the bar for calling it a loop.
    if (i >= p * 2) return words.slice(0, p).join(' ');
  }
  return text.trim();
}

/** Collapse whitespace and strip wrapping quotes a model sometimes adds. */
function tidy(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/\s+/g, ' ').trim().replace(/^["'“”]+|["'“”]+$/g, '').trim();
}

/** Cut at a word boundary rather than mid-word, without adding an ellipsis. */
function capWords(text, max) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

/**
 * A lecture title fit to render as a heading.
 * @param {unknown} raw     what the model returned
 * @param {string}  fallback used when nothing usable survives (e.g. "Lecture — 2026-09-03")
 */
export function cleanTitle(raw, fallback = '') {
  const collapsed = collapseRepetition(tidy(raw));
  const title = capWords(collapsed, MAX_TITLE_CHARS);
  return title || fallback;
}

/** A summary, de-looped and bounded. Paragraph breaks are preserved. */
export function cleanSummary(raw) {
  if (typeof raw !== 'string') return '';
  const paragraphs = raw.split(/\n{2,}/).map((p) => collapseRepetition(p.replace(/[ \t]+/g, ' ').trim())).filter(Boolean);
  // De-duplicate whole repeated paragraphs, the other shape a loop takes.
  const seen = new Set();
  const unique = paragraphs.filter((p) => {
    const key = p.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return capWords(unique.join('\n\n'), MAX_SUMMARY_CHARS);
}

/** A list of short strings — concepts, vocabulary, formulas, action items. */
export function cleanList(raw, { maxItems = MAX_LIST_ITEMS, maxChars = MAX_ITEM_CHARS } = {}) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const out = [];
  for (const entry of raw) {
    const value = capWords(collapseRepetition(tidy(entry)), maxChars);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= maxItems) break;
  }
  return out;
}

/** Definitions are {term, definition} pairs; both halves get the same care. */
export function cleanDefinitions(raw, { maxItems = MAX_LIST_ITEMS } = {}) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const entry of raw) {
    const term = capWords(collapseRepetition(tidy(entry?.term)), MAX_ITEM_CHARS);
    const definition = capWords(collapseRepetition(tidy(entry?.definition)), MAX_SUMMARY_CHARS / 10);
    if (!term || !definition) continue;
    out.push({ term, definition });
    if (out.length >= maxItems) break;
  }
  return out;
}

/**
 * The whole analysis object, sanitised in one call, so a new field cannot be
 * persisted by accident without passing through here.
 */
export function cleanAnalysis(analysis, { fallbackTitle = '' } = {}) {
  const source = analysis || {};
  return {
    ...source,
    title: cleanTitle(source.title, fallbackTitle),
    summary: cleanSummary(source.summary),
    concepts: cleanList(source.concepts),
    vocabulary: cleanList(source.vocabulary),
    definitions: cleanDefinitions(source.definitions),
    formulas: cleanList(source.formulas),
    action_items: cleanList(source.action_items),
    exam_mentions: cleanList(source.exam_mentions),
  };
}
