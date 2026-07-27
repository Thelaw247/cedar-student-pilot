import { CalendarDays, BookOpen, Brain, BarChart3, Sparkles, Settings } from 'lucide-react';

/**
 * Single source of truth for app navigation.
 *
 * Both the desktop Sidebar and the mobile BottomNav render from this list so
 * labels, icons, and destinations can never drift apart again.
 *
 * `primary: true` marks the destinations important enough to sit directly in
 * the mobile bottom bar. Everything else is still reachable on mobile via the
 * "More" sheet, so nothing is ever hidden — it's just one tap deeper. The
 * desktop sidebar shows every item inline regardless of this flag.
 *
 * Note: the Study tab (/planner) absorbed the old "Practice" / Study Tools
 * page, so there is no separate Practice nav item anymore.
 */
export const NAV_ITEMS = [
  { to: '/',          label: 'Today',    icon: CalendarDays, primary: true },
  { to: '/classes',   label: 'Classes',  icon: BookOpen,     primary: true },
  { to: '/planner',   label: 'Study',    icon: Brain,        primary: true },
  { to: '/analytics', label: 'Analytics', icon: BarChart3,   primary: true },
  { to: '/assistant', label: 'AI Assistant', icon: Sparkles, primary: false },
  { to: '/settings',  label: 'Settings', icon: Settings,     primary: false },
];

// Destinations shown directly in the mobile bottom bar.
export const PRIMARY_NAV_ITEMS = NAV_ITEMS.filter((i) => i.primary);

// Destinations that live behind the mobile "More" sheet.
export const SECONDARY_NAV_ITEMS = NAV_ITEMS.filter((i) => !i.primary);
