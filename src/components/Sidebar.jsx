import React from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '@/lib/navItems';
import { CEDAR_LOGO_URL } from '@/lib/brand';

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-card/50 h-screen sticky top-0">
      <div className="flex items-center gap-2.5 px-6 py-6">
        <img src={CEDAR_LOGO_URL} alt="Cedar Student Pilot" className="w-9 h-9 object-contain" />
        <div>
          <h1 className="font-heading font-bold text-base leading-none text-foreground">Cedar</h1>
          <p className="text-[10px] text-muted-foreground mt-0.5 tracking-wide uppercase">Student Pilot</p>
        </div>
      </div>
      <nav className="flex flex-col gap-1 px-3 mt-2 flex-1">
        {NAV_ITEMS.map((item) => (
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
    </aside>
  );
}