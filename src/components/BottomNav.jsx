import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { MoreHorizontal } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS } from '@/lib/navItems';

export default function BottomNav() {
  const [visible, setVisible] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();

  // Close the "More" sheet whenever the route changes (e.g. after tapping a link).
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

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

  // The "More" tab reads as active when the current route is one of the
  // secondary destinations that live inside the sheet.
  const onSecondaryRoute = SECONDARY_NAV_ITEMS.some(
    (item) => location.pathname === item.to || location.pathname.startsWith(item.to + '/')
  );

  return (
    <>
      <nav className={`lg:hidden fixed bottom-0 inset-x-0 z-50 bg-card/80 glass border-t border-border transition-transform duration-300 ${visible ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="flex items-center justify-around px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          {PRIMARY_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 px-4 py-1.5 rounded-lg transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`
              }
            >
              <item.icon className="w-5 h-5" strokeWidth={2} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </NavLink>
          ))}

          {/* More — opens a sheet with the remaining destinations so nothing
              is hidden on mobile, just one tap deeper. */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="More"
            className={`flex flex-col items-center gap-1 px-4 py-1.5 rounded-lg transition-colors ${
              onSecondaryRoute ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <MoreHorizontal className="w-5 h-5" strokeWidth={2} />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="lg:hidden rounded-t-2xl pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-1 gap-1 mt-4">
            {SECONDARY_NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground hover:bg-muted'
                  }`
                }
              >
                <item.icon className="w-[18px] h-[18px]" strokeWidth={2} />
                {item.label}
              </NavLink>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
