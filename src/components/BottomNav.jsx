import React from 'react';
import { NavLink } from 'react-router-dom';
import { PRIMARY_NAV_ITEMS } from '@/lib/navItems';
import { NavStudyDot } from '@/study/NavStudyClock';

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
  // z-40, not z-50: the bottom sheets opened from Today (add event, add exam,
  // rebook) are fixed at z-50 earlier in the page, and at an equal z-index
  // the later element wins — this bar drew over their bottom button rows, so
  // "Add event" and "Cancel" tapped the nav instead.
  return (
    <nav data-bottom-nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card/80 glass border-t border-border">
      <div className="flex items-center justify-around px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        {PRIMARY_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <item.icon className="w-5 h-5" strokeWidth={2} />
            <span className="text-[11px] font-medium">{item.label}</span>
            {/* No room for digits in a six-tab bar; the dot says a session is
                running and the tab it sits on is where the controls are. */}
            <NavStudyDot to={item.to} />
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
