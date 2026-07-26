import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { CalendarDays, BookOpen, Sparkles, GraduationCap, BarChart3 } from 'lucide-react';

const navItems = [
  { to: '/', label: 'Today', icon: CalendarDays },
  { to: '/classes', label: 'Classes', icon: BookOpen },
  { to: '/assistant', label: 'AI', icon: Sparkles },
  { to: '/planner', label: 'Planner', icon: GraduationCap },
  { to: '/analytics', label: 'Stats', icon: BarChart3 },
];

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
        {navItems.map((item) => (
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
      </div>
    </nav>
  );
}