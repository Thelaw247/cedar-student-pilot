import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2, CheckCircle2, AlertCircle, Zap } from 'lucide-react';

/**
 * Post-checkout landing page. Stripe redirects here with ?session_id=...
 *
 * This page does NOT grant credits on its own — it calls confirmCheckoutSession,
 * which retrieves the session from Stripe, verifies payment_status === 'paid',
 * confirms it belongs to the caller, and only then grants. The redirect itself
 * is never trusted.
 *
 * If the webhook beats this page to the grant, confirmCheckoutSession's
 * idempotency check (shared session-id anchor) makes it a no-op, so the student
 * just sees their balance.
 */
export default function CheckoutSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const [status, setStatus] = useState('loading');
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!sessionId) { setStatus('missing'); return; }
      try {
        const res = await base44.functions.invoke('confirmCheckoutSession', { session_id: sessionId });
        if (cancelled) return;
        setResult(res?.data || null);
        setStatus('done');
      } catch (e) {
        if (cancelled) return;
        setResult({ error: e?.response?.data?.error || e?.message || 'Confirmation failed' });
        setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Confirming your purchase with Stripe…</p>
          </>
        )}

        {status === 'missing' && (
          <>
            <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground mb-4">No checkout session was found in the link.</p>
            <Link to="/settings" className="text-primary text-sm font-medium hover:underline">Back to settings</Link>
          </>
        )}

        {status === 'done' && (
          <>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-4">
              <CheckCircle2 className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold mb-1">You&rsquo;re all set</h1>
            <p className="text-sm text-muted-foreground mb-6">Your credits have been added to your account.</p>
            <div className="rounded-lg border border-border p-4 mb-6 flex items-center justify-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              <span className="text-2xl font-bold tabular-nums">{result?.available ?? '—'}</span>
              <span className="text-sm text-muted-foreground">credits available</span>
            </div>
            <div className="flex gap-2 justify-center">
              <Link to="/" className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Go home</Link>
              <Link to="/settings" className="px-4 py-2 rounded-lg border border-border text-sm font-medium">Settings</Link>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-4" />
            <p className="text-sm text-muted-foreground mb-3">{result?.error || 'Something went wrong.'}</p>
            <p className="text-xs text-muted-foreground mb-4">
              If you were charged, your credits will appear once Stripe confirms the payment — you don&rsquo;t need to pay again.
            </p>
            <Link to="/settings" className="text-primary text-sm font-medium hover:underline">Back to settings</Link>
          </>
        )}
      </div>
    </div>
  );
}