import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { CEDAR_LOGO_URL } from '@/lib/brand';

const links = [
  { label: 'Product', href: '#product' },
  { label: 'Study system', href: '#study-system' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
];

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 24);
      setHidden(y > lastY && y > 180 && !menuOpen);
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 px-3 sm:px-5 transition-transform duration-300 ${hidden ? '-translate-y-[120%]' : 'translate-y-0'}`}>
      <nav className={`mx-auto mt-3 max-w-6xl rounded-2xl border transition-all duration-300 ${scrolled || menuOpen ? 'border-slate-200/80 bg-white/88 shadow-lg shadow-slate-900/5 backdrop-blur-xl' : 'border-transparent bg-white/55 backdrop-blur-md'}`}>
        <div className="flex h-14 items-center justify-between px-4 sm:px-5">
          <Link to="/" onClick={closeMenu} className="flex items-center gap-2.5" aria-label="Cedar Student Pilot home">
            <img src={CEDAR_LOGO_URL} alt="" className="h-8 w-8 object-contain" />
            <span className="hidden text-sm font-semibold tracking-[-0.02em] text-slate-950 sm:inline">Cedar Student Pilot</span>
          </Link>

          <div className="hidden items-center gap-7 md:flex">
            {links.map((link) => (
              <a key={link.href} href={link.href} className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-950">
                {link.label}
              </a>
            ))}
            <Link to="/privacy" className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-950">Privacy</Link>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 sm:inline-flex">Sign in</Link>
            <Link to="/register" className="rounded-xl bg-[#2E66FF] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#2459e8] hover:shadow-md">Start free</Link>
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 md:hidden"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="border-t border-slate-200/80 px-4 py-3 md:hidden">
            <div className="grid gap-1">
              {links.map((link) => (
                <a key={link.href} href={link.href} onClick={closeMenu} className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
                  {link.label}
                </a>
              ))}
              <Link to="/privacy" onClick={closeMenu} className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">Privacy</Link>
              <Link to="/login" onClick={closeMenu} className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:hidden">Sign in</Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
