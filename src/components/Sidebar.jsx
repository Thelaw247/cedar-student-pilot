import React from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_ITEMS } from '@/lib/navItems';
import UserMenuButton from '@/components/UserMenuButton';
import ClassStatusBar from '@/components/ClassStatusBar';
import { Search, Keyboard } from 'lucide-react';
import CreditMeter from '@/components/monetization/CreditMeter';

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-card/50 h-screen sticky top-0">
      <div className="px-4 py-5">
        <UserMenuButton />
      </div>
      {/* The always-visible credit meter (MON-04): visible limits are limits
          students forgive. Mobile placement lands with the Home header in
          phase C. */}
      <div className="px-4 pb-3">
        <CreditMeter />
      </div>
      <ClassStatusBar variant="desktop" />
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
      {/* Discoverability for two things that already work but had no visible
          entry point: Cmd+K opens the command palette (CommandPalette.jsx
          listens for the real keydown globally, so dispatching the same
          synthetic event here opens it with no new wiring), and "?" opens
          the shortcuts panel (bound in useKeyboardShortcuts). */}
      <div className="px-3 py-3 border-t border-border space-y-1">
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded border border-border">⌘K</kbd>
        </button>
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }))}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Keyboard className="w-3.5 h-3.5" />
          <span className="flex-1 text-left">Shortcuts</span>
          <kbd className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded border border-border">?</kbd>
        </button>
      </div>
    </aside>
  );
}
