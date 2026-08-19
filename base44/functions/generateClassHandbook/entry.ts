import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { invokeLLM, createLlmUsage } from '../../shared/llm.ts';
import { gateFeature, settleFeature } from '../../shared/credits.ts';

/**
 * Builds a class handbook: one chapter per lecture, in teaching order.
 *
 * Three things this function used to get wrong, all fixed here:
 *
 * 1. COST. Gap-fill expansions called Core.InvokeLLM directly, bypassing the
 *    app's own Gemini key — up to 6 Base44 integration credits' worth of calls
 *    (~18 credits) on EVERY open, from a shared 20,000/month pool. They now go
 *    through invokeLLM(), which costs 0 Base44 credits when GEMINI_API_KEY is set.
 *
 * 2. PERSISTENCE. Nothing was cached, so the handbook was rebuilt on every
 *    open: the same chapter read differently each visit because the AI
 *    expansion is non-deterministic, and chapter numbers moved whenever a new
 *    lecture landed. Results are now cached in the Handbook entity and reused
 *    while source_hash matches — a re-open costs zero LLM calls.
 *
 * 3. N+1 QUERIES. Notes were fetched one lecture at a time in an awaited loop,
 *    and expansions ran sequentially. Notes are now a single query grouped in
 *    memory, and expansions run concurrently.
 */

const EXPANSION_CAP = 6;
const TRANSCRIPT_EXCERPT_CHARS = 3000;

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/** Fingerprint the source material. Changes if a lecture is added, removed,
 *  retitled, re-transcribed or reprocessed — which is exactly when the cached
 *  handbook stops being valid. */
function sourceFingerprint(lectures: any[]): string {
  return lectures
    .map(l => [
      l.id,
      l.ai_title || '',
      (l.ai_summary || '').length,
      (l.transcript || '').length,
      (l.ai_concepts || []).length,
      (l.ai_definitions || []).length,
      (l.ai_vocabulary || []).length,
      (l.ai_formulas || []).length,
    ].join(':'))
    .join('|');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { class_id, lecture_ids, assignment_id } = body;
    if (!class_id) return Response.json({ error: 'class_id is required' }, { status: 400 });

    let cls = null;
    try { cls = await base44.entities.Class.get(class_id); } catch (e) { /* skip */ }

    // ---------------------------------------------------------- gather ----
    // Always read the full class list first: it is one query either way, and
    // it lets us report how many lectures were EXCLUDED rather than silently
    // showing a shorter book.
    const allForClass = await base44.entities.Lecture.filter({ class_id }, '-date');

    let lectures = allForClass;
    if (lecture_ids && lecture_ids.length > 0) {
      const wanted = new Set(lecture_ids);
      lectures = allForClass.filter((l: any) => wanted.has(l.id));
    }

    let scopeLabel = 'Full Class';
    if (assignment_id) {
      try {
        const asgn = await base44.entities.Assignment.get(assignment_id);
        if (asgn) {
          scopeLabel = asgn.title || 'Exam Scope';
          if (asgn.coverage_scope === 'since_last' && lectures.length > 0) {
            const allAssignments = await base44.entities.Assignment.filter({ class_id }, 'due_date');
            const prior = allAssignments
              .filter((a: any) => a.due_date < asgn.due_date)
              .sort((a: any, b: any) => b.due_date.localeCompare(a.due_date));
            if (prior.length > 0) {
              const lastExamDate = prior[0].due_date;
              lectures = lectures.filter((l: any) => l.date >= lastExamDate && l.date <= asgn.due_date);
            }
          }
        }
      } catch (e) { /* skip */ }
    }

    const hasContent = (l: any) => l.ai_summary || l.transcript || (l.ai_concepts && l.ai_concepts.length > 0);
    const lecturesWithContent = lectures
      .filter(hasContent)
      .sort((a: any, b: any) => (a.date || '').localeCompare(b.date || ''));

    // How many lectures exist in this scope but have nothing usable yet. The
    // reader surfaces this so a half-processed class doesn't just look short.
    const excludedCount = lectures.length - lecturesWithContent.length;

    if (lecturesWithContent.length === 0) {
      return Response.json({
        title: cls?.name || 'Class Handbook',
        instructor: cls?.instructor || '',
        scope_label: scopeLabel,
        table_of_contents: [],
        chapters: [],
        total_lectures: 0,
        lectures_in_scope: lectures.length,
        lectures_excluded: excludedCount,
        message: lectures.length > 0
          ? `${lectures.length} lecture${lectures.length === 1 ? '' : 's'} in this class have not been processed yet. Process them to build the handbook.`
          : 'No lecture content available yet. Record and process lectures first.',
      });
    }

    // ----------------------------------------------------------- cache ----
    const scopeKey = assignment_id
      ? `assignment:${assignment_id}`
      : (lecture_ids && lecture_ids.length > 0)
        ? `lectures:${[...lecture_ids].sort().join(',')}`
        : 'full';
    const sourceHash = await sha256(sourceFingerprint(lecturesWithContent));

    try {
      const cached = await base44.entities.Handbook.filter({ class_id, scope_key: scopeKey });
      const hit = cached?.find((h: any) => h.source_hash === sourceHash);
      if (hit?.payload) {
        const payload = JSON.parse(hit.payload);
        return Response.json({ ...payload, cached: true });
      }
    } catch (e) {
      console.error('[handbook] cache read failed, rebuilding', (e as Error).message);
    }

    // ---- CREDIT GATE ----------------------------------------------------
    // Deliberately placed AFTER the cache check: a cache hit returned above
    // does no LLM work, so re-opening an unchanged handbook stays free. Only
    // a real rebuild is billable.
    const gate = await gateFeature(base44, user.id, 'handbook');
    if (!gate.ok) return gate.response!;
    const llmUsage = createLlmUsage();

    // ----------------------------------------------------------- build ----
    // One query for all notes in the class, grouped in memory. This used to be
    // one awaited query PER LECTURE.
    const notesByLecture: Record<string, string> = {};
    try {
      const allNotes = await base44.entities.Note.filter({ class_id });
      for (const n of allNotes || []) {
        if (!n.lecture_id || !n.content) continue;
        notesByLecture[n.lecture_id] = notesByLecture[n.lecture_id]
          ? `${notesByLecture[n.lecture_id]}\n\n${n.content}`
          : n.content;
      }
    } catch (e) { /* notes are optional */ }

    const chapters = lecturesWithContent.map((lec: any, idx: number) => ({
      chapter_number: idx + 1,
      title: lec.ai_title || `Lecture — ${lec.date}`,
      lecture_id: lec.id,
      lecture_date: lec.date,
      summary: lec.ai_summary || '',
      concepts: lec.ai_concepts || [],
      definitions: lec.ai_definitions || [],
      formulas: lec.ai_formulas || [],
      vocabulary: lec.ai_vocabulary || [],
      action_items: lec.ai_action_items || [],
      exam_mentions: lec.ai_exam_mentions || [],
      notes: notesByLecture[lec.id] || '',
      transcript_excerpt: (lec.transcript || '').substring(0, TRANSCRIPT_EXCERPT_CHARS),
      transcript_length: (lec.transcript || '').length,
      ai_expansion: '',
    }));

    // Gap-fill only genuinely thin chapters, capped so a large handbook can't
    // fan out. Thinness is measured against the REAL transcript length, not the
    // truncated excerpt — the old check compared a 2000-char cap to an 800-char
    // threshold, so it was testing the truncation, not the lecture.
    const isThin = (ch: any) => {
      const conceptCount = (ch.concepts || []).length + (ch.definitions || []).length;
      return ch.transcript_length < 800 || conceptCount <= 2;
    };

    const thin = chapters.filter(isThin).slice(0, EXPANSION_CAP);

    // Concurrent, not sequential. Six awaited calls in a loop made the worst
    // case roughly six times slower than it needed to be.
    await Promise.all(thin.map(async (ch: any) => {
      try {
        const res = await invokeLLM(base44, {
          usage: llmUsage,
          prompt: `You are helping a university student study "${cls?.name || 'a class'}". Below is what was captured from one lecture. Parts of it look thinly covered — either the recording was short or some topics were only mentioned in passing.

Your job: briefly fill in ONLY the clear gaps in the topics that were ALREADY introduced in this lecture. This is supplementary context to make the student's notes usable — not a rewrite.

Strict rules:
- Only expand on concepts, terms, or topics that already appear below. Do NOT introduce new topics the lecture didn't touch.
- Keep it short: at most 2-3 tight paragraphs, or a few bullet-style sentences. Fill gaps, don't pad.
- Write it as neutral, standard explanation. Do NOT imitate or invent the professor's wording or claim the professor said something they didn't.
- If the material below is already adequately covered and needs no filling in, return an empty string.

Lecture title: ${ch.title}
Summary: ${ch.summary || '(none)'}
Concepts: ${(ch.concepts || []).join(', ') || '(none)'}
Definitions: ${(ch.definitions || []).map((d: any) => d.term).join(', ') || '(none)'}
Transcript excerpt: ${ch.transcript_excerpt || '(none)'}

Return ONLY the supplementary explanation text (or an empty string if none is needed). No preamble.`,
        });
        const expansion = typeof res === 'string' ? res : (res?.text || '');
        if (expansion && expansion.trim().length > 0) ch.ai_expansion = expansion.trim();
      } catch (e) {
        // Non-fatal: a chapter simply gets no expansion.
      }
    }));

    const table_of_contents = chapters.map((ch: any) => ({
      chapter: ch.chapter_number,
      title: ch.title,
      lecture_id: ch.lecture_id,
      date: ch.lecture_date,
      // Lets the contents list show which chapters are thin before you open them.
      has_expansion: !!ch.ai_expansion,
      section_count: [
        ch.summary, ch.concepts?.length, ch.definitions?.length, ch.formulas?.length,
        ch.vocabulary?.length, ch.action_items?.length, ch.exam_mentions?.length, ch.notes,
      ].filter(Boolean).length,
    }));

    const payload = {
      title: cls?.name || 'Class Handbook',
      instructor: cls?.instructor || '',
      class_color: cls?.color || '#3B82F6',
      scope_label: scopeLabel,
      is_scoped: !!(lecture_ids && lecture_ids.length > 0) || !!assignment_id,
      total_lectures: lecturesWithContent.length,
      lectures_in_scope: lectures.length,
      lectures_excluded: excludedCount,
      generated_at: new Date().toISOString(),
      table_of_contents,
      chapters,
    };

    // ------------------------------------------------------------ save ----
    // Best-effort: a cache write failure must not fail the user's request.
    try {
      const serialized = JSON.stringify(payload);
      const existing = await base44.asServiceRole.entities.Handbook.filter({
        user_id: user.id, class_id, scope_key: scopeKey,
      });
      if (existing && existing.length > 0) {
        await base44.asServiceRole.entities.Handbook.update(existing[0].id, {
          source_hash: sourceHash,
          payload: serialized,
          total_lectures: payload.total_lectures,
          generated_at: payload.generated_at,
        });
        // Clean up any duplicate rows for this scope so the cache stays single-valued.
        for (const dup of existing.slice(1)) {
          try { await base44.asServiceRole.entities.Handbook.delete(dup.id); } catch (e) { /* ignore */ }
        }
      } else {
        await base44.asServiceRole.entities.Handbook.create({
          user_id: user.id,
          class_id,
          scope_key: scopeKey,
          source_hash: sourceHash,
          payload: serialized,
          total_lectures: payload.total_lectures,
          generated_at: payload.generated_at,
        });
      }
    } catch (e) {
      console.error('[handbook] cache write failed', (e as Error).message);
    }

    // Charged only now that the handbook is built and cached.
    await settleFeature(base44, gate, {
      feature: 'handbook',
      llmUsage,
    });

    return Response.json({ ...payload, cached: false });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
