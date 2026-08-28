/**
 * One source of truth for event-type presentation (Design Blueprint, law 02
 * + global fix #4). Event types are distinguished by icon and label — never
 * by an invented hue. Before this module, "work" was amber in WeekView and
 * emerald in Timeline; study was purple everywhere for no reason.
 *
 * Color rules (enforced by the callers, documented here):
 *  - class + study items render in the CLASS's own color (they belong to it)
 *  - personal events (work / appointment / custom / reminder) render neutral
 *  - semantic colors (good / attention / problem) are reserved for state
 */
import { GraduationCap, Briefcase, BookOpen, Bell, Calendar, Clock } from 'lucide-react';

export const EVENT_META = {
  class:       { icon: GraduationCap, label: 'Class' },
  study:       { icon: BookOpen,      label: 'Study' },
  work:        { icon: Briefcase,     label: 'Work' },
  appointment: { icon: Clock,         label: 'Appointment' },
  reminder:    { icon: Bell,          label: 'Reminder' },
  custom:      { icon: Calendar,      label: 'Event' },
};

export function eventMeta(type) {
  return EVENT_META[type] || EVENT_META.custom;
}
