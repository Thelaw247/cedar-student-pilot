import React from 'react';
import { NavLink } from 'react-router-dom';
import { CalendarDays, BookOpen, Sparkles, GraduationCap } from 'lucide-react';

const navItems = [
  { to: '/', label: 'Today', icon: CalendarDays },
  { to: '/classes', label: 'Classes', icon: BookOpen },
  { to: '/assistant', label: 'AI', icon: Sparkles },
  { to: '/planner', label: 'Planner', icon: GraduationCap },
];

export default function BottomNav() {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-card/80 glass border-t border-border">
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