import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import Stars from '@/components/ui/Stars';
import { Loader2 } from 'lucide-react';

/**
 * The review queue on the owner dashboard (/owner). Every review, the ones
 * waiting for a check first; "Show on site" puts the student's own words on
 * praelecta.ca, "Take off site" removes them. A review whose student did not
 * tick "show on praelecta.ca" has no button: it is theirs, and private.
 * The real gate is server-side (owner-reviews: requireAdmin, and an approval
 * that only succeeds with the student's consent on the row).
 */
const day = (d) => (d ? new Date(d).toLocaleDateString() : '—');

export default function OwnerReviews() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = async (args = {}) => {
    try {
      const res = await base44.functions.invoke('ownerReviews', args);
      setData(res?.data || null);
      setError(null);
    } catch (e) {
      setError(e?.response?.data?.error || e.message || 'Could not load the reviews.');
    }
  };

  useEffect(() => { load(); }, []);

  const decide = async (id, approve) => {
    setBusyId(id);
    await load({ id, approve });
    setBusyId(null);
  };

  const s = data?.summary;

  return (
    <section>
      <h2 className="font-heading text-lg font-semibold mb-1">Student reviews</h2>
      <p className="text-sm text-muted-foreground mb-3">
        {s
          ? `${s.ratings} rating${s.ratings === 1 ? '' : 's'}${s.average != null ? ` · average ${Number(s.average).toFixed(1)}` : ''} · ${s.waiting} waiting for a check · ${s.shown} on the site · ${s.declined} declined`
          : 'Ratings and words students left from the app. The homepage shows the average once there are five ratings.'}
      </p>
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {!data && !error && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
      {data && data.reviews.filter((r) => !r.declined).length === 0 && (
        <p className="text-sm text-muted-foreground">No reviews yet. Students are asked on Today once they have a processed lecture or a week in the app.</p>
      )}
      <div className="space-y-3">
        {data?.reviews.filter((r) => !r.declined).map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Stars rating={r.rating} />
              <span className="text-xs text-muted-foreground">{r.full_name || r.email} · {day(r.updated_at)}</span>
            </div>
            {r.body && <p className="mt-2 text-sm text-foreground">&ldquo;{r.body}&rdquo;</p>}
            {r.may_publish && (
              <p className="mt-1 text-xs text-muted-foreground">
                As: {[r.display_name, r.detail, r.school].filter(Boolean).join(', ')}
              </p>
            )}
            <div className="mt-3 flex items-center gap-2">
              {!r.may_publish && <span className="text-xs text-muted-foreground">Private. The student did not ask for it to be shown.</span>}
              {r.may_publish && !r.approved_at && (
                <button type="button" disabled={busyId === r.id} onClick={() => decide(r.id, true)}
                  className="min-h-[36px] rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  Show on site
                </button>
              )}
              {r.may_publish && r.approved_at && (
                <>
                  <span className="text-xs font-medium text-emerald-600">On the site since {day(r.approved_at)}</span>
                  <button type="button" disabled={busyId === r.id} onClick={() => decide(r.id, false)}
                    className="min-h-[36px] rounded-lg border border-border px-3 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-50">
                    Take off site
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
