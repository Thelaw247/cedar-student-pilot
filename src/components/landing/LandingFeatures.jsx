import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Brain, CalendarClock, FileCheck2, Laptop, Mic, Target } from 'lucide-react';
import { FEATURES } from '@/lib/features';

/**
 * The feature grid: one tile per feature page, from lib/features.js (the
 * label, the one-line blurb and the link are the same record the pages and
 * the footer read), plus two tiles for the things a student asks about that
 * are not a page of their own — that the notes come from the lecture, and
 * where it runs. Six tiles, each an icon, a label and one line; the long
 * form of everything here is one click away, so the grid stays a grid.
 */
const ICONS = {
  'lecture-recorder': Mic,
  'test-coverage': Target,
  'study-schedule': CalendarClock,
  'study-system': Brain,
};

const EXTRA = [
  {
    slug: 'accuracy',
    icon: FileCheck2,
    label: 'Notes you can check',
    blurb: 'The transcript sits beside every summary, and anything taken only from the recording is marked, so you know what to double-check.',
    to: '/lecture-recorder#accuracy',
    more: 'See how notes are checked',
  },
  {
    slug: 'devices',
    icon: Laptop,
    label: 'Runs where you are',
    blurb: 'The browser on any phone or laptop, desktop apps for Windows, Mac and Linux, and an iPhone app on the way.',
    to: '#download',
    more: 'Get the desktop app',
  },
];

export const FEATURE_TILES = [
  ...FEATURES.map((f) => ({ slug: f.slug, icon: ICONS[f.slug], label: f.label, blurb: f.blurb, to: f.path, more: `See the ${f.label.toLowerCase()}` })),
  ...EXTRA,
];

function Tile({ tile }) {
  const inner = (
    <>
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <tile.icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-5 text-xl font-bold tracking-[-0.03em] text-foreground">{tile.label}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{tile.blurb}</p>
      <span className="mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-primary transition-colors group-hover:text-foreground">
        {tile.more} <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </>
  );
  const className = 'group flex flex-col rounded-[26px] border border-border bg-card p-6 shadow-[0_18px_55px_-35px_rgba(0,0,0,0.6)] transition-all hover:-translate-y-1 hover:border-primary/30 sm:p-7';
  return tile.to.startsWith('#')
    ? <a href={tile.to} className={className}>{inner}</a>
    : <Link to={tile.to} className={className}>{inner}</Link>;
}

export default function LandingFeatures() {
  return (
    <section id="features" className="px-4 py-16 sm:px-6 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-4xl font-bold tracking-[-0.045em] text-foreground sm:text-5xl">What one recording gives you</h2>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">One recording feeds all of it. Nothing to rebuild by hand.</p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FEATURE_TILES.map((tile) => <Tile key={tile.slug} tile={tile} />)}
        </div>
      </div>
    </section>
  );
}
