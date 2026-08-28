import React from 'react';
import { classTint, classColor } from '@/lib/color';

/**
 * The tinted icon box (Design Blueprint, global fix #2). Before this existed
 * the same box was hand-rolled 14 times across the app with three different
 * size/radius combos and a fragile `color + '20'` background hack.
 *
 * Sizes follow the concentric radius ladder: the chip's radius is one step
 * below its parent card's, so corners stay optically parallel.
 */
const BOX = {
  sm: 'w-8 h-8 rounded-lg',
  md: 'w-9 h-9 rounded-lg',
  lg: 'w-12 h-12 rounded-xl',
};
const GLYPH = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export default function IconChip({ icon: Icon, size = 'md', color, className = '' }) {
  // With a class color: tint from the color itself. Without one: brand chip.
  const style = color ? { backgroundColor: classTint(color), color: classColor(color) } : undefined;
  return (
    <span
      className={`${BOX[size]} flex items-center justify-center flex-shrink-0 ${color ? '' : 'bg-primary/10 text-primary'} ${className}`}
      style={style}
    >
      <Icon className={GLYPH[size]} strokeWidth={1.75} />
    </span>
  );
}
