import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { BRAND_MARK_URL } from '@/lib/brand';

// Anchors are written as /#section rather than #section so the same nav works
// from /pricing, /about and /changelog: on the homepage the browser treats a
// same-path hash as a scroll, anywhere else it opens the homepage there.
// Pricing is its own page since 18 Sep 2026 — the full table, not the teaser.
const links = [
  { label: 'Recording', href: '/#recording' },
  { label: 'Test coverage', href: '/#test-coverage' },
  { label: 'Study schedule', href: '/#study-schedule' },
  { label: 'Study tools', href: '/#study-system' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'FAQ', href: '/#faq' },
  { label: 'Desktop', href: '/#download' },
];

function NavLink({ link, className, onClick = undefined }) {
  return link.to
    ? <Link to={link.to} onClick={onClick} className={className}>{link.label}</Link>
    : <a href={link.href} onClick={onClick} className={className}>{link.label}</a>;
}

/**
 * The header is a floating glass pill (28 Sep 2026): the page scrolls under
 * it, blurred and tinted through it, the way Apple's chrome sits over
 * content. It uses `.glass-chrome` from index.css — the design system's one
 * sanctioned glass surface for navigation, with the opaque fallback for
 * browsers without backdrop-filter and for prefers-reduced-transparency — so
 * nothing here is a second glass recipe. The pill squares its corners while
 * the phone menu is open so the menu reads as part of the same surface.
 */
export default function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
      {/* A soft fade from the page colour behind the pill, so scrolled
          content does not sit raw in the gap above it. It is a decoration
          layer, not the header's background: the strip stays see-through. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-24 bg-gradient-to-b from-[hsl(222_33%_8%/0.9)] via-[hsl(222_33%_8%/0.45)] to-transparent" />
      <nav
        aria-label="Site"
        className={`glass-chrome mx-auto max-w-6xl border shadow-[0_14px_44px_-22px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.14)] transition-[border-radius] duration-300 ease-standard ${menuOpen ? 'rounded-[28px]' : 'rounded-full'}`}
      >
        <div className="flex h-14 items-center justify-between pl-4 pr-2 sm:pl-5 sm:pr-2.5">
          <Link to="/" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5" aria-label="Praelecta home">
            <img src={BRAND_MARK_URL} alt="" className="h-8 w-8 object-contain" />
            <span className="text-sm font-semibold text-foreground">Praelecta</span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <NavLink key={link.label} link={link} className="rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground" />
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <Link to="/login" className="hidden rounded-full px-3 py-1.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/[0.06] hover:text-foreground sm:inline-flex">Sign in</Link>
            <Link to="/register" className="auth-cta rounded-full px-4 py-2 text-sm font-semibold text-primary-foreground">Start free</Link>
            <button type="button" onClick={() => setMenuOpen((value) => !value)} className="inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-foreground/[0.06] md:hidden" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen}>
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-border/70 px-2 pb-3 pt-2 md:hidden">
            {links.map((link) => (
              <NavLink key={link.label} link={link} onClick={() => setMenuOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/[0.06]" />
            ))}
            <Link to="/login" onClick={() => setMenuOpen(false)} className="block rounded-xl px-3 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/[0.06] sm:hidden">Sign in</Link>
          </div>
        )}
      </nav>
    </header>
  );
}