import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useTodaySchedule } from '@/hooks/useTodaySchedule';
import { Zap, Clock, MapPin, GraduationCap } from 'lucide-react';

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const dh = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${dh}:${String(m).padStart(2, '0')} ${ampm}`;
}

/**
 * Extra-wide-desktop only (xl: ~1280px+). Below that, this column doesn't
 * render at all — mobile and regular desktop are completely unaffected.
 *
 * The point isn't new functionality: every number here is already visible
 * somewhere else in the app (Home's timeline, Settings' subscription panel).
 * This is a standing summary for the screen space that's otherwise just
 * background on a wide monitor, using the exact same shared schedule hook
 * ClassStatusBar uses so the two can't disagree.
 */
export default function DesktopRail() {
  const { loaded, remaining, current } = useTodaySchedule();
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await base44.entities.CreditBalance.list();
        if (!cancelled) setBalance(rows?.[0] || null);
      } catch {
        // Non-fatal — the rail just omits the credits card.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const available = balance ? (balance.subscription_credits || 0) + (balance.purchased_credits || 0) : null;

  return (
    <aside className="hidden xl:flex w-72 flex-shrink-0 flex-col gap-4 border-l border-border px-4 py-5 h-screen sticky top-0 overflow-y-auto">
      {/* Rest of today */}
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
          Rest of today
        </p>
        {!loaded ? (
          <div className="h-16 rounded-xl bg-muted/50 animate-pulse" />
        ) : remaining.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1">Nothing else scheduled today.</p>
        ) : (
          <div className="space-y-1.5">
            {remaining.map((c) => {
              const isNow = current?.id === c.id;
              return (
                <Link
                  key={c.id}
                  to={`/classes/${c.id}`}
                  className={`flex items-center gap-2.5 rounded-lg p-2 transition-colors hover:bg-muted ${isNow ? 'bg-primary/5' : ''}`}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: (c.color || '#3B82F6') + '20', color: c.color || '#3B82F6' }}
                  >
                    <GraduationCap className="w-4 h-4" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground truncate">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />{formatTime(c.start_time)}
                      {c.room && <><MapPin className="w-2.5 h-2.5 ml-1" />{c.room}</>}
                    </p>
                  </div>
                  {isNow && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse flex-shrink-0" />}
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Credits */}
      {balance && (
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <Zap className="w-3.5 h-3.5 text-primary" />
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Credits</p>
          </div>
          <p className="text-xl font-bold text-foreground">{available}</p>
          <p className="text-[10px] text-muted-foreground capitalize">{balance.tier || 'free'} plan</p>
          {balance.fair_use_flagged && (
            <p className="text-[10px] text-amber-600 mt-1">Heavy usage this period</p>
          )}
        </div>
      )}
    </aside>
  );
}

