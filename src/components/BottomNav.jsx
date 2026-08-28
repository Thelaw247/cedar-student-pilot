import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { PRIMARY_NAV_ITEMS } from '@/lib/navItems';

/**
 * Mobile bottom navigation.
 *
 * Every destination is a tab now. There used to be a "More" button opening a
 * sheet for secondary destinations, but with the AI Assistant entry gone that
 * sheet would have held Settings alone — a tap to open a sheet to tap one item
 * — so Settings became a tab and the sheet was removed. Reinstate it here if a
 * non-primary nav item is ever added back.
 */
export default function BottomNav() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let lastScroll = window.scrollY;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const current = window.scrollY;
        if (current < 10) {
          setVisible(true);
        } else if (current > lastScroll && current > 60) {
          setVisible(false);
        } else if (current < lastScroll) {
          setVisible(true);
        }
        lastScroll = current;
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`lg:hidden fixed bottom-0 inset-x-0 z-50 bg-card/80 glass border-t border-border transition-transform duration-300 ${visible ? 'translate-y-0' : 'translate-y-full'}`}>
      <div className="flex items-center justify-around px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        {PRIMARY_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <item.icon className="w-5 h-5" strokeWidth={2} />
            <span className="text-[11px] font-medium">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
