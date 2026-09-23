import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Package } from 'lucide-react';
import { TIERS, CREDIT_PACKS, semesterSaving } from '@/lib/tiers';
import { FAQ } from '@/lib/faq';
import { PUBLIC_PAGES } from '@/lib/publicPages';
import MarketingShell from '@/components/landing/MarketingShell';
import PricingTiers from '@/components/landing/PricingTiers';
import CreditsExplainer from '@/components/landing/CreditsExplainer';
import PaymentTrustLine from '@/components/landing/PaymentTrustLine';
import LandingProof from '@/components/landing/LandingProof';

/**
 * /pricing — the whole offer on one public page.
 *
 * Until 18 Sep 2026 the homepage showed the two starting prices and four
 * tier names, and the full table lived in the terms of service. A student
 * comparing plans had to read a legal document to find out what Scholar
 * costs. This page is the table: four tiers at both billing periods with
 * their credits, the feature comparison row for row, the credit packs, the
 * real semester saving per tier, and the credit model in plain words. Every
 * figure is read from lib/tiers.js, the same record the checkout charges.
 */
const money = (n) => `$${n.toFixed(2)}`;
const BILLING_FAQ = ['price', 'credits', 'cancel', 'allowed'];

export default function Pricing() {
  const savings = ['student', 'scholar', 'unlimited'].map((id) => ({ tier: TIERS[id], saving: semesterSaving(TIERS[id]) }));

  return (
    <MarketingShell {...PUBLIC_PAGES['/pricing']}>
      <section className="px-4 pb-16 pt-28 sm:px-6 sm:pt-32">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <LandingProof />
            <p className="mt-5 text-sm font-semibold text-primary">Pricing</p>
            <h1 className="mt-2 text-4xl font-bold tracking-[-0.045em] text-foreground sm:text-5xl">Free to try. Less than a textbook to keep.</h1>
            <p className="mt-4 text-base leading-7 text-muted-foreground sm:text-lg">
              Two full lectures on us, no card needed. After that, one plan and one bill: by the month, or once a semester so it matches your term. Every price is in Canadian dollars, and the price you sign up at is your price for as long as you stay.
            </p>
          </div>

          <div className="mt-12">
            <PricingTiers />
          </div>

          <PaymentTrustLine className="mt-8" />

          <div className="mt-14 grid gap-6 lg:grid-cols-2 lg:items-start">
            <CreditsExplainer />

            <div className="rounded-[26px] border border-border bg-card p-7 sm:p-8">
              <Package className="h-6 w-6 text-primary" />
              <h2 className="mt-5 text-2xl font-bold tracking-[-0.03em] text-foreground">Credit packs</h2>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                A one-off top-up for a heavy month. Packs never expire, survive a downgrade or a cancellation, and don&rsquo;t change your plan. Plan credits are spent first, pack credits after.
              </p>
              <ul className="mt-5 divide-y divide-border overflow-hidden rounded-xl border border-border">
                {CREDIT_PACKS.map((pack) => (
                  <li key={pack.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                    <span className="font-semibold text-foreground">{pack.name} · {pack.credits} credits</span>
                    <span className="text-muted-foreground">{money(pack.price)} <span className="text-xs">({(pack.price / pack.credits * 100).toFixed(1)}¢ a credit)</span></span>
                  </li>
                ))}
              </ul>

              <h3 className="mt-8 text-base font-bold text-foreground">What a semester saves</h3>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                {savings.map(({ tier, saving }) => saving && (
                  <li key={tier.id}>
                    <span className="font-semibold text-foreground">{tier.name}</span>: {money(tier.semester)} a semester instead of {money(tier.monthly * 4)} over four months — save {money(Number(saving.saved))} ({saving.percent}%).
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">A semester plan bills once every four months and renews automatically until you cancel. Cancelling stops the next renewal; you keep everything until the period you paid for ends.</p>
            </div>
          </div>

          <div className="mx-auto mt-14 max-w-3xl">
            <h2 className="text-center text-2xl font-bold tracking-[-0.03em] text-foreground">The billing questions, answered</h2>
            <div className="mt-6 divide-y divide-border overflow-hidden rounded-[26px] border border-border bg-card">
              {BILLING_FAQ.map((id) => FAQ.find((f) => f.id === id)).filter(Boolean).map((item) => (
                <div key={item.id} className="px-5 py-4 sm:px-6">
                  <p className="text-base font-semibold text-foreground">{item.question}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.answer}</p>
                </div>
              ))}
            </div>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              The fine print, in plain words, is in the <Link to="/terms" className="font-semibold text-primary hover:text-foreground">terms of service</Link>.
            </p>
          </div>

          <div className="mt-14 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/register" className="auth-cta inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-primary-foreground sm:w-auto">
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/login" className="inline-flex w-full items-center justify-center rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground/85 transition-colors hover:bg-muted sm:w-auto">
              Already have an account? Upgrade in Settings
            </Link>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
