/**
 * OwnerAnalytics — admin-only business dashboard at /owner.
 *
 * Shows revenue, cost-to-serve and PROFIT per customer in one place. Stripe
 * can't show cost; Base44 can't show revenue; this joins both server-side via
 * the ownerAnalytics function.
 *
 * This is gated in the UI for tidiness, but the real gate is server-side:
 * ownerAnalytics returns 403 for non-admins regardless of what the client does.
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

const money = (n) => (n == null ? '—' : `$${Number(n).toFixed(2)}`);
const pct = (n) => (n == null ? '—' : `${n}%`);
const short = (d) => (d ? new Date(d).toLocaleDateString() : '—');

function Stat({ label, value, sub, tone }) {
  const toneClass =
    tone === 'good' ? 'text-emerald-600'
      : tone === 'bad' ? 'text-red-600'
        : 'text-foreground';
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`font-heading text-2xl font-bold mt-1 ${toneClass}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default function OwnerAnalytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('ownerAnalytics', {});
      if (res?.error) throw new Error(res.error);
      setData(res);
    } catch (e) {
      setError(e.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">Couldn't load analytics</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const t = data.totals;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">Business overview</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Revenue, cost to serve and margin. Generated {new Date(data.generated_at).toLocaleString()}.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Revenue" value={money(t.revenue_cad)} sub={`${t.paying_customers} paying`} />
        <Stat label="Cost to serve" value={money(t.cost_cad)} sub={`${t.total_actions} AI actions`} />
        <Stat
          label="Profit"
          value={money(t.profit_cad)}
          sub={`${pct(t.margin_pct)} margin`}
          tone={t.profit_cad >= 0 ? 'good' : 'bad'}
        />
        <Stat label="ARPU" value={money(t.arpu_cad)} sub={`${t.active_subscribers} subscribed`} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Total users" value={t.users} />
        <Stat label="Free tier" value={t.free_users} />
        <Stat label="Subscribers" value={t.active_subscribers} />
        <Stat label="Refunded" value={money(t.refunded_cad)} />
      </div>

      <section>
        <h2 className="font-heading text-lg font-semibold mb-3">By plan</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                {['Plan', 'Users', 'Revenue', 'Cost', 'Profit', 'Actions'].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.by_tier.map((r) => (
                <tr key={r.tier} className="border-t border-border">
                  <td className="px-3 py-2 capitalize font-medium">{r.tier}</td>
                  <td className="px-3 py-2">{r.customers}</td>
                  <td className="px-3 py-2">{money(r.revenue_cad)}</td>
                  <td className="px-3 py-2">{money(r.cost_cad)}</td>
                  <td className={`px-3 py-2 font-medium ${r.profit_cad >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {money(r.profit_cad)}
                  </td>
                  <td className="px-3 py-2">{r.actions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold mb-3">Where the cost goes</h2>
        {data.by_feature.length === 0 ? (
          <p className="text-sm text-muted-foreground">No usage recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  {['Feature', 'Uses', 'Credits charged', 'Total cost', 'Avg cost'].map((h) => (
                    <th key={h} className="px-3 py-2 font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.by_feature.map((f) => (
                  <tr key={f.feature} className="border-t border-border">
                    <td className="px-3 py-2 font-medium">{f.feature.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2">{f.actions}</td>
                    <td className="px-3 py-2">{f.credits_charged}</td>
                    <td className="px-3 py-2">{money(f.cost_cad)}</td>
                    <td className="px-3 py-2">{money(f.avg_cost_cad)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-heading text-lg font-semibold mb-3">Customers</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                {['Customer', 'Plan', 'Joined', 'Credits left', 'Actions', 'Revenue', 'Cost', 'Profit', 'Margin'].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.customers.map((c) => (
                <tr key={c.user_id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <p className="font-medium">{c.name || '—'}</p>
                    <p className="text-xs text-muted-foreground">{c.email}</p>
                  </td>
                  <td className="px-3 py-2 capitalize whitespace-nowrap">
                    {c.tier}{c.subscribed && <span className="ml-1 text-[10px] text-emerald-600 uppercase">sub</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{short(c.joined)}</td>
                  <td className="px-3 py-2">{c.available_credits}</td>
                  <td className="px-3 py-2">
                    {c.actions}
                    {c.failures > 0 && <span className="ml-1 text-xs text-amber-600">({c.failures} failed)</span>}
                  </td>
                  <td className="px-3 py-2">{money(c.revenue_cad)}</td>
                  <td className="px-3 py-2">{money(c.cost_cad)}</td>
                  <td className={`px-3 py-2 font-medium ${c.profit_cad >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {money(c.profit_cad)}
                  </td>
                  <td className="px-3 py-2">{pct(c.margin_pct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 space-y-1">
        <p className="font-medium">How to read these numbers</p>
        <p>{data.notes.cost}</p>
        <p>{data.notes.fees}</p>
        <p>{data.notes.coverage}</p>
      </div>
    </div>
  );
}
