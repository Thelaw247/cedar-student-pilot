import React, { useState, useEffect, useRef } from 'react';
import { Plus, X } from 'lucide-react';

export default function FloatingActionButton({ actions }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-40">
      {open && (
        <div className="absolute bottom-16 right-0 space-y-1.5 animate-fade-in">
          {actions.map((a, i) => (
            <button
              key={i}
              onClick={() => { a.onClick(); setOpen(false); }}
              className="flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-xl bg-card border border-border shadow-lg text-sm font-medium text-foreground hover:bg-primary/5 hover:border-primary/30 transition-all whitespace-nowrap"
            >
              <a.icon className="w-4 h-4 text-primary flex-shrink-0" />
              {a.label}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
          open ? 'bg-card border border-border text-foreground rotate-90' : 'bg-primary text-primary-foreground hover:bg-primary/90'
        }`}
      >
        {open ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
      </button>
    </div>
  );
}