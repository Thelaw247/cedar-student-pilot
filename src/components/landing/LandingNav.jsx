import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { CEDAR_LOGO_URL } from '@/lib/brand';

const links = [
  { label: 'Recording', href: '#recording' },
  { label: 'Test coverage', href: '#test-coverage' },
  { label: 'Study schedule', href: '#study-schedule' },
  { label: 'Pricing', href: '#pricing' },
];

export default function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur-lg">
      <nav className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" onClick={() => setMenuOpen(false)} className="flex items-center gap-2.5" aria-label="Cedar Student Pilot home">
            <img src={CEDAR_LOGO_URL} alt="" className="h-8 w-8 object-contain" />
            <span className="text-sm font-semibold text-slate-950">Cedar Student Pilot</span>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            {links.map((link) => (
              <a key={link.href} href={link.href} className="text-sm font-medium text-slate-600 hover:text-slate-950">{link.label}</a>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden px-3 py-2 text-sm font-medium text-slate-700 hover:text-slate-950 sm:inline-flex">Sign in</Link>
            <Link to="/register" className="rounded-xl bg-[#2E66FF] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2459e8]">Start free</Link>
            <button type="button" onClick={() => setMenuOpen((value) => !value)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 md:hidden" aria-label={menuOpen ? 'Close menu' : 'Open menu'}>
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-slate-200 py-3 md:hidden">
            {links.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">{link.label}</a>
            ))}
            <Link to="/login" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:hidden">Sign in</Link>
          </div>
        )}
      </nav>
    </header>
  );
}