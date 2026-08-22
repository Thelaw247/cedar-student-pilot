import React from 'react';
import { Command, Calendar, Mic, Search, ArrowLeft, HelpCircle } from 'lucide-react';

const SHORTCUTS = [
  { keys: ['⌘', 'K'], label: 'Open command palette', icon: Command },
  { keys: ['N'], label: 'New event', icon: Calendar },
  { keys: ['R'], label: 'Start recording', icon: Mic },
  { keys: ['/'], label: 'Focus search', icon: Search },
  { keys: ['Space'], label: 'Play / pause lecture', icon: Command },
  { keys: ['←', '→'], label: 'Skip audio backward / forward', icon: ArrowLeft },
  { keys: ['Esc'], label: 'Close modal or dialog', icon: Command },
  { keys: ['?'], label: 'Show this shortcut list', icon: HelpCircle },
];

export default function ShortcutsHelp({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 glass px-4" onClick={onClose}>
      <div className="w-full max-w-md bg-card rounded-modal border border-border shadow-3 p-6 animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-lg font-semibold">Keyboard Shortcuts</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-sm">Close</button>
        </div>
        <div className="space-y-1">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-2 px-1 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2.5">
                <s.icon className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                <span className="text-sm text-foreground">{s.label}</span>
              </div>
              <div className="flex items-center gap-1">
                {s.keys.map((k, j) => (
                  <kbd key={j} className="inline-block min-w-[28px] text-center text-xs font-medium border border-border bg-muted rounded px-1.5 py-0.5">
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
