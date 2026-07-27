import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, FileText, GraduationCap } from 'lucide-react';

/**
 * Lecture content search results for a given query. Controlled by a parent
 * search box (see Classes.jsx) so a single input can search across both
 * classes and lecture content at once. Renders nothing until there's a query
 * of at least 2 characters.
 */
export default function LectureSearch({ query = '', heading = 'In your lectures' }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const value = (query || '').trim();
    if (value.length < 2) {
      setResults([]);
      setActive(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setActive(true);
      try {
        const res = await base44.functions.invoke('searchLectures', { query: value });
        setResults(res.data?.results || []);
      } catch (e) {
        setResults([]);
      }
      setLoading(false);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  if (!active) return null;

  return (
    <div className="mt-4 space-y-2 animate-fade-in">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">{heading}</p>
      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
        </div>
      ) : results.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2 px-1">No lecture matches.</p>
      ) : (
        <>
          {results.map((r) => (
            <Link key={r.lecture_id} to={`/lectures/${r.lecture_id}`}
              className="block rounded-xl border border-border bg-card p-3 hover:shadow-md transition-all">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1.5">
                <GraduationCap className="w-3 h-3" />
                {r.class_name} · {r.date} · <span className="uppercase">{r.match_type}</span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{r.snippet}</p>
            </Link>
          ))}
        </>
      )}
    </div>
  );
}
