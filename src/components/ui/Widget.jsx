import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import IconChip from '@/components/ui/IconChip';
import { classColor } from '@/lib/color';

/**
 * The one surface grammar (Design Blueprint §2, law 01). Every container on
 * every screen is this Widget: icon chip, title, meta line, optional collapse,
 * rows. The meta line is the law-04 summary — a collapsed widget already told
 * you the answer, expanding shows the evidence.
 *
 * Collapse state persists per user via `storageKey` (localStorage,
 * `cedar-w-<key>`), so the app remembers how each person likes each screen.
 *
 * `action` renders on the header's right, before the chevron; interactive
 * actions must stopPropagation so they don't toggle the collapse.
 */
export default function Widget({
  icon = undefined,
  iconColor = undefined,
  title,
  meta = undefined,
  action = undefined,
  collapsible = false,
  defaultOpen = true,
  storageKey = undefined,
  className = '',
  padded = false,
  // Controlled mode: pass `open` (and `onOpenChange`) to drive the collapse
  // from outside — the lecture page uses it to pop the transcript open when
  // a concept's "show in transcript" is tapped. Uncontrolled otherwise.
  open: openProp = undefined,
  onOpenChange = undefined,
  id = undefined,
  children,
}) {
  const [openState, setOpenState] = useState(() => {
    if (!collapsible) return true;
    if (storageKey) {
      try {
        const v = localStorage.getItem(`cedar-w-${storageKey}`);
        if (v != null) return v === '1';
      } catch { /* storage unavailable — fall through to default */ }
    }
    return defaultOpen;
  });

  const controlled = openProp !== undefined;
  const open = controlled ? openProp : openState;

  const toggle = () => {
    if (!collapsible) return;
    const next = !open;
    if (storageKey) {
      try { localStorage.setItem(`cedar-w-${storageKey}`, next ? '1' : '0'); } catch { /* best-effort */ }
    }
    if (controlled) onOpenChange?.(next);
    else setOpenState(next);
  };

  const onKeyDown = (e) => {
    if (!collapsible) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggle();
    }
  };

  return (
    <section id={id} className={`rounded-xl border border-border bg-card shadow-1 overflow-hidden ${className}`}>
      <div
        role={collapsible ? 'button' : undefined}
        tabIndex={collapsible ? 0 : undefined}
        aria-expanded={collapsible ? open : undefined}
        onClick={collapsible ? toggle : undefined}
        onKeyDown={onKeyDown}
        className={`flex items-center gap-2.5 px-4 py-3 ${collapsible ? 'cursor-pointer hover:bg-muted/40 transition-colors duration-micro select-none' : ''}`}
      >
        {icon && <IconChip icon={icon} size="sm" color={iconColor} />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{title}</p>
          {meta && <p className="text-[11px] text-muted-foreground truncate">{meta}</p>}
        </div>
        {action}
        {collapsible && (
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground flex-shrink-0 transition-transform duration-standard ease-standard ${open ? 'rotate-180' : ''}`}
          />
        )}
      </div>
      <div className={`grid transition-[grid-template-rows] duration-standard ease-standard ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden min-h-0">
          <div className={padded ? 'px-4 pb-4' : ''}>{children}</div>
        </div>
      </div>
    </section>
  );
}

/**
 * The standard row inside a Widget: optional class-color rail, optional icon,
 * title + meta stack, right-aligned (tabular) content. Renders as a Link when
 * `to` is given, a button when `onClick` is given, a plain row otherwise.
 */
export function WidgetRow({
  railColor = undefined,
  icon: Icon = undefined,
  title,
  meta = undefined,
  right = undefined,
  to = undefined,
  onClick = undefined,
  className = '',
}) {
  const inner = (
    <>
      {railColor && (
        <span className="w-[3px] h-7 rounded-full flex-shrink-0" style={{ backgroundColor: classColor(railColor) }} />
      )}
      {Icon && <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" strokeWidth={1.75} />}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{title}</p>
        {meta && <p className="text-[11px] text-muted-foreground truncate">{meta}</p>}
      </div>
      {right && <div className="flex-shrink-0 text-[11px] text-muted-foreground tabular-nums text-right">{right}</div>}
    </>
  );
  const rowClass = `flex items-center gap-2.5 px-4 py-2.5 border-t border-border ${to || onClick ? 'hover:bg-muted/40 transition-colors duration-micro' : ''} ${className}`;
  if (to) return <Link to={to} className={rowClass}>{inner}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className={`w-full text-left ${rowClass}`}>{inner}</button>;
  return <div className={rowClass}>{inner}</div>;
}
