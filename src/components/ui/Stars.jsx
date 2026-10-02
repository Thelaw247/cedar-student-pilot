import React from 'react';
import { Star, StarHalf } from 'lucide-react';

/**
 * A read-only star rating: the homepage line, each review card, the
 * student's own review in Settings and the owner's queue. One image to a
 * screen reader ("4.7 out of 5 stars"), five shapes to everyone else.
 *
 * The shapes round to the nearest half star, never up to a whole one: a 4.7
 * average draws four and a half stars, not five, so the picture never says
 * more than the number beside it.
 */
export default function Stars({ rating, className = 'h-4 w-4' }) {
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  const halves = Math.round(value * 2);
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value % 1 ? value.toFixed(1) : value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const full = halves >= n * 2;
        const half = !full && halves === n * 2 - 1;
        return (
          <span key={n} className="relative inline-flex" aria-hidden="true">
            <Star className={`${className} ${full ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
            {half && <StarHalf className={`${className} absolute inset-0 fill-amber-400 text-amber-400`} />}
          </span>
        );
      })}
    </span>
  );
}
