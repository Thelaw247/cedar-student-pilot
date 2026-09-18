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

export default function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-background/85 backdrop-blur-lg">
      <nav className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5" aria-label="Praelecta home">
            <img src={BRAND_MARK_URL} alt="" className="h-8 w-8 object-contain" />
            <span className="text-sm font-semibold text-foreground">Praelecta</span>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            {links.map((link) => (
              <NavLink key={link.label} link={link} className="text-sm font-medium text-muted-foreground hover:text-foreground" />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden px-3 py-2 text-sm font-medium text-foreground/80 hover:text-foreground sm:inline-flex">Sign in</Link>
            <Link to="/register" className="auth-cta rounded-xl px-4 py-2 text-sm font-semibold text-primary-foreground">Start free</Link>
            <button type="button" onClick={() => setMenuOpen((value) => !value)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-foreground/80 hover:bg-muted md:hidden" aria-label={menuOpen ? 'Close menu' : 'Open menu'}>
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-border py-3 md:hidden">
            {links.map((link) => (
              <NavLink key={link.label} link={link} onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/80 hover:bg-muted" />
            ))}
            <Link to="/login" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/80 hover:bg-muted sm:hidden">Sign in</Link>
          </div>
        )}
      </nav>
    </header>
  );
}