import React from 'react';
import { Link } from 'react-router-dom';
import { GLANCE_COMPETITORS, GLANCE_ROWS, PRAELECTA_GLANCE, competitorBySlug } from '@/lib/competitors';

/**
 * Praelecta against the monthly apps, at a glance, on the pricing page: the
 * two study apps a student has most likely seen first, on the things the
 * reviews say they decide on, one line per cell, with the date the columns
 * were read and a link to the full page for each. The facts are
 * lib/competitors.js, the same table the /vs pages read; Praelecta's column
 * is built from tiers.js.
 */
const longDate = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

export default function LandingCompare() {
  const them = GLANCE_COMPETITORS.map(competitorBySlug).filter(Boolean);
  if (!them.length) return null;
  const checkedOn = them.map((c) => c.checkedOn).sort().at(-1);

  return (
    <section id="compare" className="px-4 pb-20 pt-4 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold text-primary">Next to the monthly apps</p>
          <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">Same job, different bill.</h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            Their columns are from their own sites and app-store listings as of {longDate(checkedOn)}, in US dollars; Praelecta&rsquo;s is in Canadian dollars.
          </p>
        </div>

        <div className="mt-10 overflow-x-auto rounded-[26px] border border-border bg-card">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="w-[22%] px-4 py-4 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground sm:px-6">&nbsp;</th>
                <th scope="col" className="px-4 py-4 text-base font-bold text-foreground sm:px-6">Praelecta</th>
                {them.map((c) => (
                  <th key={c.slug} scope="col" className="px-4 py-4 text-base font-bold text-foreground sm:px-6">{c.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GLANCE_ROWS.map((row) => (
                <tr key={row.id} className="border-b border-border align-top last:border-b-0">
                  <th scope="row" className="px-4 py-3.5 text-sm font-semibold text-foreground sm:px-6">{row.label}</th>
                  <td className="px-4 py-3.5 font-medium leading-6 text-foreground sm:px-6">{PRAELECTA_GLANCE[row.id]}</td>
                  {them.map((c) => (
                    <td key={c.slug} className="px-4 py-3.5 leading-6 text-muted-foreground sm:px-6">{c.glance[row.id]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">
          The full comparisons, with every row and the pages each fact came from:{' '}
          {them.map((c, i) => (
            <React.Fragment key={c.slug}>
              <Link to={`/vs/${c.slug}`} className="font-semibold text-primary hover:text-foreground">Praelecta vs {c.name}</Link>
              {i < them.length - 1 ? ' · ' : ''}
            </React.Fragment>
          ))}
          . {them.map((c) => c.name).join(' and ')} are trademarks of their owners; Praelecta is not affiliated with either.
        </p>
      </div>
    </section>
  );
}
