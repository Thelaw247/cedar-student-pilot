import React from 'react';
import { Link } from 'react-router-dom';
import { BRAND_MARK_URL } from '@/lib/brand';
import { FOUNDER } from '@/lib/founder';
import { COMPETITORS } from '@/lib/competitors';
import { FEATURES } from '@/lib/features';
import { SUPPORT_MAILTO } from '@/lib/legal';

/**
 * The footer of every public page, in three labelled columns and a bottom
 * bar, so a visitor scanning for one link reads a heading, not a paragraph
 * of links:
 *
 *   brand + one line + the person    Product · Company · Compare
 *   © · privacy line                 Privacy · Terms · Sign in
 *
 * Product is the feature pages (lib/features.js) and the desktop app;
 * Company is who, how much and what changed; Compare is the honest table
 * against each competitor (lib/competitors.js), "vs Lemora" on screen and
 * "Praelecta vs Lemora" to a screen reader and a search engine.
 *
 * The founder's name stays beside "Made in Canada" on purpose: a study app
 * asking for lecture audio should have a person on it, not only a flag. The
 * LinkedIn link appears only once the address is filled in (lib/founder.js).
 */

const linkCls = 'text-muted-foreground transition-colors hover:text-foreground';

function Column({ title, children }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/70">{title}</p>
      <ul className="mt-4 space-y-3 text-sm">{children}</ul>
    </div>
  );
}

export default function LandingFooter() {
  return (
    <footer className="px-4 pb-10 pt-12 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
        <div className="max-w-xs">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <img src={BRAND_MARK_URL} alt="" className="h-7 w-7 object-contain" />
            <span className="text-base font-semibold text-foreground">Praelecta</span>
          </Link>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Lecture recordings that turn into notes, practice and a study plan.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Made in Canada by{' '}
            <Link to="/about" className="font-medium text-foreground/80 hover:text-foreground">{FOUNDER.name}</Link>
            {FOUNDER.linkedin && (
              <> · <a href={FOUNDER.linkedin} target="_blank" rel="noreferrer" className="hover:text-foreground">LinkedIn</a></>
            )}
          </p>
        </div>

        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3">
          <Column title="Product">
            {/* The feature pages, not the homepage anchors: from any page,
                the long form of each feature is one click away. */}
            {FEATURES.map((f) => (
              <li key={f.slug}><Link to={f.path} className={linkCls}>{f.label}</Link></li>
            ))}
            <li><a href="/#download" className={linkCls}>Desktop app</a></li>
          </Column>
          <Column title="Company">
            <li><Link to="/about" className={linkCls}>About</Link></li>
            <li><Link to="/pricing" className={linkCls}>Pricing</Link></li>
            <li><a href="/#faq" className={linkCls}>FAQ</a></li>
            <li><Link to="/changelog" className={linkCls}>What&rsquo;s new</Link></li>
            <li><a href={SUPPORT_MAILTO} className={linkCls}>Contact</a></li>
          </Column>
          {/* The comparison pages, under their own heading: a student weighing
              two apps should find the honest table from any page. */}
          <Column title="Compare">
            {COMPETITORS.map((c) => (
              <li key={c.slug}>
                <Link to={`/vs/${c.slug}`} className={linkCls}><span className="sr-only">Praelecta </span>vs {c.name}</Link>
              </li>
            ))}
          </Column>
        </nav>
      </div>

      <div className="mx-auto mt-12 flex max-w-6xl flex-col gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>&copy; {new Date().getFullYear()} Praelecta. Your recordings stay private to you.</p>
        <div className="flex gap-5">
          <Link to="/privacy" className={linkCls}>Privacy</Link>
          <Link to="/terms" className={linkCls}>Terms</Link>
          <Link to="/login" className={linkCls}>Sign in</Link>
        </div>
      </div>
    </footer>
  );
}
