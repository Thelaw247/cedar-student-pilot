import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { query } = body;
    if (!query || query.trim().length < 2) {
      return Response.json({ results: [] });
    }

    const searchTerm = query.toLowerCase().trim();

    // Get all lectures for the user (up to 200)
    const lectures = await base44.entities.Lecture.list('-date', 200);

    // Get classes for name lookup
    const classIds = [...new Set(lectures.map(l => l.class_id).filter(Boolean))];
    const classes = [];
    for (const cid of classIds) {
      try {
        const cls = await base44.entities.Class.get(cid);
        classes.push(cls);
      } catch (e) { /* skip */ }
    }
    const classMap = Object.fromEntries(classes.map(c => [c.id, c]));

    const results = [];

    for (const lec of lectures) {
      const className = classMap[lec.class_id]?.name || 'Unknown Class';
      const title = lec.ai_title || `Lecture on ${lec.date}`;

      // Search in transcript, summary, concepts, vocabulary
      const searchable = [
        { text: lec.transcript || '', type: 'transcript' },
        { text: lec.ai_summary || '', type: 'summary' },
        { text: (lec.ai_concepts || []).join(' '), type: 'concepts' },
        { text: (lec.ai_vocabulary || []).join(' '), type: 'vocabulary' },
      ];

      for (const { text, type } of searchable) {
        if (!text) continue;
        const lower = text.toLowerCase();
        const idx = lower.indexOf(searchTerm);
        if (idx !== -1) {
          const start = Math.max(0, idx - 60);
          const end = Math.min(text.length, idx + searchTerm.length + 60);
          const snippet = (start > 0 ? '...' : '') + text.substring(start, end) + (end < text.length ? '...' : '');
          results.push({
            lecture_id: lec.id,
            class_id: lec.class_id,
            class_name: className,
            date: lec.date,
            title,
            snippet,
            match_type: type,
          });
          break; // one match per lecture is enough
        }
      }

      if (results.length >= 20) break;
    }

    return Response.json({ results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});