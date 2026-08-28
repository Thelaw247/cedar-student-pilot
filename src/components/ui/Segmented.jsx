import React from 'react';

/**
 * iOS-style segmented control (Design Blueprint, global fix #14). Replaces
 * the underline tab bars so switching views reads as flipping a physical
 * switch, not navigating a website nav.
 */
export default function Segmented({ options, value, onChange, className = '' }) {
  return (
    <div role="tablist" className={`inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5 ${className}`}>
      {options.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(o.value)}
            className={`px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors duration-micro whitespace-nowrap ${selected ? 'bg-card text-foreground shadow-1' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
