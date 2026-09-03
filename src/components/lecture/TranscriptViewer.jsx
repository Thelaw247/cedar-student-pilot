import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FileText, Search, X, Sparkles, Loader2, Lock } from 'lucide-react';
import Widget from '@/components/ui/Widget';

/**
 * The transcript, readable and searchable, with the study page's anchors
 * landing in it.
 *
 * `jump` is `{ quote, offset, nonce }` from an AnchorButton: the widget opens
 * itself, highlights the sentence at `offset`, and scrolls it into view.
 * Search highlights every match and steps through them. Both are plain
 * string offsets over the transcript — the same offsets the server resolved
 * (lectureEnrichment.locateQuote) — so what the badge promised is what is
 * shown.
 */
export default function TranscriptViewer({ lecture, jump, actions, cleanup }) {
  const [open, setOpen] = useState(() => {
    try { const v = localStorage.getItem('cedar-w-lec-transcript'); return v == null ? false : v === '1'; } catch { return false; }
  });
  const [query, setQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);
  const scrollRef = useRef(null);
  const activeRef = useRef(null);
  const transcript = lecture.transcript || '';

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const out = [];
    const hay = transcript.toLowerCase();
    let at = hay.indexOf(q);
    while (at >= 0 && out.length < 500) { out.push({ start: at, end: at + q.length }); at = hay.indexOf(q, at + q.length); }
    return out;
  }, [query, transcript]);

  // Which range is "active": the current search match, else the jumped anchor.
  const active = useMemo(() => {
    if (matches.length) return matches[Math.min(matchIndex, matches.length - 1)];
    if (jump && Number.isInteger(jump.offset) && jump.offset >= 0) {
      const len = Math.max(20, Math.min(220, (jump.quote || '').length + 60));
      return { start: jump.offset, end: Math.min(transcript.length, jump.offset + len) };
    }
    return null;
  }, [matches, matchIndex, jump, transcript.length]);

  useEffect(() => { setMatchIndex(0); }, [query]);
  useEffect(() => {
    if (!jump) return;
    setQuery('');
    setOpen(true);
  }, [jump]);
  useEffect(() => {
    if (!open || !active) return;
    const t = setTimeout(() => activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 120);
    return () => clearTimeout(t);
  }, [active, open]);

  const segments = useMemo(() => buildSegments(transcript, matches, active), [transcript, matches, active]);
  const words = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;

  return (
    <Widget id="sec-transcript" icon={FileText} title="Transcript" meta={`${words.toLocaleString()} words${lecture.transcript_cleaned ? ' · cleaned up' : ''}`}
      action={actions ? <span onClick={(e) => e.stopPropagation()}>{actions}</span> : undefined}
      collapsible open={open} onOpenChange={setOpen} storageKey="lec-transcript" className="mb-4 scroll-mt-24" padded>
      <div className="pt-1">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
          <label className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && matches.length) setMatchIndex((i) => (i + 1) % matches.length); }}
              placeholder="Search the transcript…"
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
            )}
          </label>
          {query.trim().length >= 2 && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground tabular-nums">
              {matches.length ? `${Math.min(matchIndex + 1, matches.length)} of ${matches.length}` : 'No matches'}
              {matches.length > 1 && (
                <>
                  <button type="button" onClick={() => setMatchIndex((i) => (i - 1 + matches.length) % matches.length)} className="px-1.5 py-0.5 rounded border border-border hover:bg-muted">‹</button>
                  <button type="button" onClick={() => setMatchIndex((i) => (i + 1) % matches.length)} className="px-1.5 py-0.5 rounded border border-border hover:bg-muted">›</button>
                </>
              )}
            </div>
          )}
        </div>

        {cleanup}

        <div ref={scrollRef} className="max-h-[32rem] overflow-y-auto pr-2">
          <p className="text-[15px] text-foreground/85 leading-7 whitespace-pre-wrap max-w-[68ch]">
            {segments.map((seg, i) => {
              if (seg.kind === 'text') return <React.Fragment key={i}>{seg.text}</React.Fragment>;
              if (seg.kind === 'active') {
                return <mark key={i} ref={activeRef} className="rounded px-0.5 bg-primary/25 text-foreground ring-2 ring-primary/40">{seg.text}</mark>;
              }
              return <mark key={i} className="rounded px-0.5 bg-amber-300/50 dark:bg-amber-400/30 text-foreground">{seg.text}</mark>;
            })}
          </p>
        </div>
      </div>
    </Widget>
  );
}

function buildSegments(text, matches, active) {
  const ranges = [];
  for (const m of matches) ranges.push({ ...m, kind: 'match' });
  if (active && !matches.length) ranges.push({ ...active, kind: 'active' });
  else if (active) {
    const i = ranges.findIndex((r) => r.start === active.start);
    if (i >= 0) ranges[i] = { ...ranges[i], kind: 'active' };
  }
  ranges.sort((a, b) => a.start - b.start);
  const out = [];
  let cursor = 0;
  for (const r of ranges) {
    if (r.start < cursor) continue;
    if (r.start > cursor) out.push({ kind: 'text', text: text.slice(cursor, r.start) });
    out.push({ kind: r.kind, text: text.slice(r.start, r.end) });
    cursor = r.end;
  }
  if (cursor < text.length) out.push({ kind: 'text', text: text.slice(cursor) });
  return out;
}

/** The cleanup controls, kept in one place so LectureDetail stays readable. */
export function TranscriptCleanup({ lecture, cleanGate, cleaning, cleanError, cleanResult, onClean, onRestore }) {
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between gap-3">
        {lecture.transcript_cleaned ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600"><Sparkles className="w-3 h-3" /> Cleaned up</span>
        ) : (
          <p className="text-[11px] text-muted-foreground">Raw transcript. Clean it up if this recording came out noisy.</p>
        )}
        {!lecture.transcript_cleaned && !cleanGate.allowed && (
          <button onClick={cleanGate.lock} title={`Transcript cleanup ships with ${cleanGate.requiredTierName}`}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted text-[11px] font-medium text-muted-foreground hover:text-foreground flex-shrink-0 transition-colors">
            <Lock className="w-3 h-3" /> Clean up transcript
          </button>
        )}
        {!lecture.transcript_cleaned && cleanGate.allowed && (
          <button onClick={onClean} disabled={cleaning}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 flex-shrink-0 transition-colors">
            {cleaning ? <><Loader2 className="w-3 h-3 animate-spin" /> Cleaning…</> : <><Sparkles className="w-3 h-3" /> Clean up transcript</>}
          </button>
        )}
      </div>
      {cleanError && <p className="text-[11px] text-destructive mt-2">{cleanError}</p>}
      {cleanResult && !cleanError && (
        <p className="text-[11px] text-muted-foreground mt-2">
          Cleaned in {cleanResult.calls} pass{cleanResult.calls === 1 ? '' : 'es'}
          {cleanResult.delta > 0 ? ` · ${cleanResult.delta.toLocaleString()} characters changed` : ' · the transcript was already clean'}
          . The original is kept — you can restore it below.
        </p>
      )}
      {lecture.transcript_cleaned && lecture.transcript_raw && (
        <button onClick={onRestore} disabled={cleaning} className="mt-1 text-[11px] text-muted-foreground hover:text-foreground underline disabled:opacity-50">
          Restore the original
        </button>
      )}
    </div>
  );
}
