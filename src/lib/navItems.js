import { CalendarDays, BookOpen, GraduationCap, BarChart3, Brain, Sparkles, Settings } from 'lucide-react';

/**
 * Single source of truth for app navigation.
 *
 * Both the desktop Sidebar and the mobile BottomNav render from this list so
 * labels, icons, and destinations can never drift apart again (previously the
 * two were different sets — mobile was missing Study Tools and Settings, and
 * "Analytics" showed as "Stats").
 *
 * `primary: true` marks the destinations important enough to sit directly in
 * the mobile bottom bar. Everything else is still reachable on mobile via the
 * "More" sheet, so nothing is ever hidden — it's just one tap deeper. The
 * desktop sidebar shows every item inline regardless of this flag.
 */
export const NAV_ITEMS = [
  { to: '/',            label: 'Today',    icon: CalendarDays, primary: true },
  { to: '/classes',     label: 'Classes',  icon: BookOpen,     primary: true },
  { to: '/planner',     label: 'Planner',  icon: GraduationCap, primary: true },
  { to: '/analytics',   label: 'Analytics', icon: BarChart3,   primary: true },
  { to: '/study-tools', label: 'Study Tools', icon: Brain,     primary: false },
  { to: '/assistant',   label: 'AI Assistant', icon: Sparkles, primary: false },
  { to: '/settings',    label: 'Settings', icon: Settings,     primary: false },
];

// Destinations shown directly in the mobile bottom bar.
export const PRIMARY_NAV_ITEMS = NAV_ITEMS.filter((i) => i.primary);

// Destinations that live behind the mobile "More" sheet.
export const SECONDARY_NAV_ITEMS = NAV_ITEMS.filter((i) => !i.primary);
