import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Search, X, Loader2, FileText, GraduationCap } from 'lucide-react';

export default function LectureSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef(null);

  const handleSearch = (value) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setShowResults(true);
      try {
        const res = await base44.functions.invoke('searchLectures', { query: value });
        setResults(res.data?.results || []);
      } catch (e) {
        setResults([]);
      }
      setLoading(false);
    }, 400);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  return (
    <div className="relative mb-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search across all your lectures..."
          className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        {query && (
          <button onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {showResults && (
        <div className="mt-2 space-y-2 animate-fade-in">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No matches found in your lectures.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground px-1">{results.length} match{results.length !== 1 ? 'es' : ''} found</p>
              {results.map((r) => (
                <Link key={r.lecture_id} to={`/lectures/${r.lecture_id}`}
                  onClick={() => { setShowResults(false); setQuery(''); }}
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
      )}
    </div>
  );
}