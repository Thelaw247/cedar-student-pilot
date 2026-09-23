import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ExternalLink, Scale } from 'lucide-react';
import MarketingShell from '@/components/landing/MarketingShell';
import { COMPARISON_ROWS, PRAELECTA_FACTS, competitorBySlug } from '@/lib/competitors';
import { PUBLIC_PAGES } from '@/lib/publicPages';
import { SUPPORT_EMAIL } from '@/lib/legal';

/**
 * /vs/<competitor> — Praelecta against one other study app, side by side.
 *
 * A student searching "Praelecta vs Lemora" is already choosing, so the page
 * is a fair table and two honest lists, not a pitch. The competitor column
 * is facts from their own site on a stated date (lib/competitors.js), with
 * "not stated" where they say nothing, and the pages it was read from are
 * linked at the bottom. One component, three routes (App.jsx); the routes
 * are written out so the sitemap test can see each one.
 */
const longDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

export default function Compare({ competitor: slug }) {
  const them = competitorBySlug(slug);
  const page = PUBLIC_PAGES[`/vs/${slug}`];
  if (!them || !page) return null;

  return (
    <MarketingShell {...page}>
      <section className="px-4 pb-20 pt-28 sm:px-6 sm:pt-32">
        <div className="mx-auto max-w-5xl">
          <p className="text-sm font-semibold text-primary">Compare</p>
          <h1 className="mt-2 text-4xl font-bold tracking-[-0.045em] text-foreground sm:text-5xl">Praelecta vs {them.name}</h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground">
            {them.summary} Praelecta records the lecture too, then scopes the studying to what the test covers and books the study sessions around your calendar, billed by the semester in Canadian dollars.
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">
            Everything in the {them.name} column is taken from{' '}
            <a href={them.url} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:text-foreground">their own site</a>
            {' '}as of {longDate(them.checkedOn)}. Their prices are in US dollars, Praelecta’s in Canadian. Where their site does not say, the table says so.
          </p>

          {/* Three readable columns need about 640px; on a phone the table
              scrolls sideways inside its card, like the calendar mockup. */}
          <div className="mt-10 overflow-x-auto rounded-[26px] border border-border bg-card">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="w-[22%] px-4 py-4 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground sm:px-6">&nbsp;</th>
                  <th scope="col" className="w-[39%] px-4 py-4 text-base font-bold text-foreground sm:px-6">Praelecta</th>
                  <th scope="col" className="w-[39%] px-4 py-4 text-base font-bold text-foreground sm:px-6">{them.name}</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-b-0 align-top">
                    <th scope="row" className="px-4 py-4 text-sm font-semibold text-foreground sm:px-6">{row.label}</th>
                    <td className="px-4 py-4 leading-6 text-muted-foreground sm:px-6">{PRAELECTA_FACTS[row.id]}</td>
                    <td className="px-4 py-4 leading-6 text-muted-foreground sm:px-6">{them.facts[row.id]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="rounded-[26px] border border-primary/30 bg-card p-6 sm:p-7">
              <h2 className="text-2xl font-bold tracking-[-0.03em] text-foreground">When to pick Praelecta</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                {them.whenPraelecta.map((line) => (
                  <li key={line} className="flex gap-2.5"><Check className="mt-1 h-4 w-4 flex-none text-primary" aria-hidden="true" /><span>{line}</span></li>
                ))}
              </ul>
            </div>
            <div className="rounded-[26px] border border-border bg-card p-6 sm:p-7">
              <h2 className="text-2xl font-bold tracking-[-0.03em] text-foreground">When to pick {them.name}</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                {them.whenThem.map((line) => (
                  <li key={line} className="flex gap-2.5"><Scale className="mt-1 h-4 w-4 flex-none text-muted-foreground" aria-hidden="true" /><span>{line}</span></li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link to="/register" className="auth-cta inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-primary-foreground">
              Try Praelecta free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/pricing" className="inline-flex items-center justify-center rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground/85 transition-colors hover:bg-muted">
              See every plan
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Two full lectures free, no card needed.</p>

          <div className="mt-12 border-t border-border pt-6 text-xs leading-5 text-muted-foreground">
            <p className="font-semibold text-foreground">Where the {them.name} column comes from</p>
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {them.sources.map((href) => (
                <li key={href}>
                  <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                    {href.replace(/^https?:\/\/(www\.)?/, '')} <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-3">
              {them.name} is a trademark of its owner; Praelecta is not affiliated with it. If anything here is out of date, email{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-foreground/80 hover:text-foreground">{SUPPORT_EMAIL}</a> and it will be corrected.
            </p>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
