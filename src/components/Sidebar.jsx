import React from 'react';
import { NavLink } from 'react-router-dom';
import { CalendarDays, BookOpen, Sparkles, GraduationCap, Settings, GraduationCap as Logo } from 'lucide-react';

const navItems = [
  { to: '/', label: 'Today', icon: CalendarDays },
  { to: '/classes', label: 'Classes', icon: BookOpen },
  { to: '/assistant', label: 'AI Assistant', icon: Sparkles },
  { to: '/planner', label: 'Study Planner', icon: GraduationCap },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-card/50 h-screen sticky top-0">
      <div className="flex items-center gap-2.5 px-6 py-6">
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
          <Logo className="w-5 h-5 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="font-heading font-bold text-base leading-none text-foreground">Cedar</h1>
          <p className="text-[10px] text-muted-foreground mt-0.5 tracking-wide uppercase">Student Pilot</p>
        </div>
      </div>
      <nav className="flex flex-col gap-1 px-3 mt-2 flex-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`
            }
          >
            <item.icon className="w-[18px] h-[18px]" strokeWidth={2} />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4">
        <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 p-4 border border-primary/10">
          <p className="text-xs font-medium text-foreground">Need help studying?</p>
          <p className="text-[11px] text-muted-foreground mt-1">Ask your AI assistant anything about your lectures.</p>
        </div>
      </div>
    </aside>
  );
}