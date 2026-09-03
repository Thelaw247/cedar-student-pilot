/**
 * Helpers shared by the lecture study page components.
 *
 * `ai_enrichment` (server/lib/lectureEnrichment.js) is the second analysis
 * pass; everything here is defensive because a lecture processed before
 * 3 Sep 2026 has `{}` there and must render exactly as it did.
 */

export function enrichmentOf(lecture) {
  const e = lecture?.ai_enrichment;
  if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
  if (!e.version) return null;
  return e;
}

export const hasAnchor = (item) => Number.isInteger(item?.anchor?.offset) && item.anchor.offset >= 0;

/**
 * Where a student can read more about a concept. Built from the model's
 * search query (or the concept name) — plain search URLs, nothing that
 * needs an API key, and each opens in a new tab so the lecture stays put.
 */
export function resourceLinks(concept) {
  const q = (concept?.search_query || concept?.name || '').trim();
  if (!q) return [];
  const enc = encodeURIComponent(q);
  return [
    { label: 'Wikipedia', href: `https://en.wikipedia.org/w/index.php?search=${enc}` },
    { label: 'YouTube', href: `https://www.youtube.com/results?search_query=${enc}` },
    { label: 'Khan Academy', href: `https://www.khanacademy.org/search?page_search_query=${enc}` },
    { label: 'Scholar', href: `https://scholar.google.com/scholar?q=${enc}` },
  ];
}

export const DIFFICULTY_LABEL = { core: 'Core', supporting: 'Supporting', advanced: 'Advanced' };
export const DIFFICULTY_CLASS = {
  core: 'bg-primary/10 text-primary',
  supporting: 'bg-muted text-muted-foreground',
  advanced: 'bg-purple-500/10 text-purple-600',
};

export const TODO_KIND_LABEL = { task: 'Task', read: 'Reading', practice: 'Practice', submit: 'Submit', review: 'Review', prepare: 'Prepare' };

/** Counts for the header stat strip and the jump nav. */
export function enrichmentCounts(e) {
  if (!e) return null;
  return {
    outline: e.outline?.length || 0,
    concepts: e.concepts?.length || 0,
    formulas: e.formulas?.length || 0,
    verifiedFormulas: (e.formulas || []).filter((f) => f.verified).length,
    definitions: e.definitions?.length || 0,
    examples: e.examples?.length || 0,
    exam: e.exam_radar?.length || 0,
    questions: e.questions?.length || 0,
  };
}

export function scrollToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
