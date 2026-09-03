import { CalendarDays, BookOpen, Brain, ListChecks, BarChart3, Settings } from 'lucide-react';

/**
 * Single source of truth for app navigation.
 *
 * Both the desktop Sidebar and the mobile BottomNav render from this list so
 * labels, icons, and destinations can never drift apart again.
 *
 * `primary: true` marks the destinations shown directly in the mobile bottom
 * bar. Every item is currently primary: the mobile "More" sheet used to hold
 * the leftovers, but once the AI Assistant entry was removed it would have held
 * a single link, so Settings was promoted into the bar and the sheet dropped.
 * Adding a non-primary item again means reinstating that sheet in BottomNav.
 * The desktop sidebar shows every item inline regardless of this flag.
 *
 * Note: the Study tab (/planner) absorbed the old "Practice" / Study Tools
 * page, so there is no separate Practice nav item anymore.
 */
export const NAV_ITEMS = [
  { to: '/today',     label: 'Today',     icon: CalendarDays, primary: true },
  { to: '/classes',   label: 'Classes',   icon: BookOpen,     primary: true },
  { to: '/planner',   label: 'Study',     icon: Brain,        primary: true },
  // To-do (3 Sep 2026): the checklist the enrichment pass fills from each
  // lecture, plus the student's own items. Six primary tabs still fit a
  // 360px bar at 11px labels; the mobile bar renders them evenly.
  { to: '/todos',     label: 'To-do',     icon: ListChecks,   primary: true },
  { to: '/analytics', label: 'Analytics', icon: BarChart3,    primary: true },
  { to: '/settings',  label: 'Settings',  icon: Settings,     primary: true },
];

// Destinations shown directly in the mobile bottom bar.
export const PRIMARY_NAV_ITEMS = NAV_ITEMS.filter((i) => i.primary);
