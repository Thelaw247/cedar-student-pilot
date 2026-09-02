import React from 'react';
import { NavLink } from 'react-router-dom';
import { PRIMARY_NAV_ITEMS } from '@/lib/navItems';

/**
 * Mobile bottom navigation.
 *
 * Always visible. It used to hide on scroll-down and reappear on scroll-up,
 * which meant the primary navigation vanished exactly when a student was
 * reading down a lecture or a long class list — the tabs are how you move
 * between the five sections, so they stay put. (Reported 2 Sep: "the footer
 * with the page buttons disappears when I scroll on mobile.")
 *
 * Every destination is a tab. There used to be a "More" button opening a
 * sheet for secondary destinations, but with the AI Assistant entry gone that
 * sheet would have held Settings alone, so Settings became a tab and the sheet
 * was removed. Reinstate it here if a non-primary nav item is ever added back.
 */
export default function BottomNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-card/80 glass border-t border-border">
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
