import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import PaymentTrustLine from '@/components/landing/PaymentTrustLine';
import { FounderLine } from '@/components/landing/LandingProof';

/**
 * The last thing on the page: one more "Start free", after the FAQ has had
 * its say. The billing facts sit under the button here rather than in the
 * hero — this is the button a visitor presses having read the page — and
 * the person who built it is the last line before the footer.
 */
export default function LandingFinalCta() {
  return (
      <section className="relative isolate overflow-hidden px-4 pb-24 sm:px-6 lg:pb-28">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[34px] border border-white/12 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(46,102,255,0.07)_44%,rgba(255,255,255,0.03))] px-6 py-14 text-center shadow-[0_34px_95px_-30px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-1px_0_rgba(0,0,0,0.35)] backdrop-blur-[34px] backdrop-saturate-[195%] sm:px-10 sm:py-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_14%_2%,rgba(255,255,255,0.10),transparent_30%),radial-gradient(circle_at_78%_12%,rgba(96,165,250,0.16),transparent_34%),radial-gradient(circle_at_58%_100%,rgba(46,102,255,0.22),transparent_42%)]" />
          <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent" />
          <div className="pointer-events-none absolute left-[8%] top-[-22%] h-44 w-[42%] rotate-[-8deg] rounded-[50%] bg-primary/18 blur-3xl" />
          <div className="pointer-events-none absolute right-[2%] bottom-[-16%] h-44 w-[34%] rotate-[14deg] rounded-[50%] bg-primary/20 blur-3xl" />

          <div className="relative z-10">
            <h2 className="mx-auto max-w-3xl text-balance text-4xl font-bold tracking-[-0.045em] text-foreground sm:text-5xl">Record your next lecture and see the notes for yourself.</h2>
            <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-foreground/80">Two full lectures free, up to 90 minutes each, no card. Try it on your own class this week.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/register" className="auth-cta inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-base font-semibold text-primary-foreground transition-all hover:-translate-y-0.5">Record your first lecture free <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              <Link to="/login" className="inline-flex items-center justify-center rounded-2xl border border-border bg-card/60 px-6 py-3.5 text-base font-semibold text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.10)] backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:bg-card/80">Sign in</Link>
            </div>
            <PaymentTrustLine className="mt-6" />
            <div className="mt-8 flex justify-center">
              <FounderLine className="max-w-2xl" />
            </div>
          </div>
        </div>
      </section>
  );
}
