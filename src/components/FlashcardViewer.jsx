import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, RotateCw, Shuffle } from 'lucide-react';

/**
 * Flashcards on the token system (Design Blueprint, Lecture fixes): the
 * gradient faces are gone — question is a card with a blue rail, answer a
 * card with a green rail (state color: it's the resolution). Adds keyboard
 * support (arrows to move, space/enter to flip) and progress dots.
 */
export default function FlashcardViewer({ flashcards }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shuffled, setShuffled] = useState(flashcards);

  const count = shuffled?.length || 0;

  const next = useCallback(() => { setIndex((i) => (i + 1) % count); setFlipped(false); }, [count]);
  const prev = useCallback(() => { setIndex((i) => (i - 1 + count) % count); setFlipped(false); }, [count]);

  useEffect(() => {
    const onKey = (e) => {
      // Never steal keys from a form field elsewhere on the page.
      const el = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFlipped((f) => !f); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev]);

  if (!flashcards || flashcards.length === 0) return null;

  const card = shuffled[index];

  const shuffle = () => {
    const arr = [...flashcards];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setShuffled(arr);
    setIndex(0);
    setFlipped(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-1 p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground tabular-nums">{index + 1} / {count}</p>
        <button onClick={shuffle} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <Shuffle className="w-3.5 h-3.5" /> Shuffle
        </button>
      </div>

      <div className="[perspective:1000px] mb-3">
        <button onClick={() => setFlipped(!flipped)}
          className="relative w-full min-h-[180px] rounded-xl transition-transform duration-300 motion-reduce:transition-none [transform-style:preserve-3d]"
          style={{ transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
          <div className="absolute inset-0 rounded-xl bg-background border border-border flex items-center justify-center p-6 [backface-visibility:hidden] overflow-hidden">
            <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-primary" />
            <div className="text-center">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-2">Question</p>
              <p className="text-base font-medium text-foreground">{card.front}</p>
              <p className="text-[11px] text-muted-foreground mt-3">Tap to flip</p>
            </div>
          </div>
          <div className="absolute inset-0 rounded-xl bg-background border border-border flex items-center justify-center p-6 [backface-visibility:hidden] [transform:rotateY(180deg)] overflow-hidden">
            <span className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-emerald-500" />
            <div className="text-center">
              <p className="text-[11px] text-emerald-600 uppercase tracking-wide mb-2">Answer</p>
              <p className="text-sm text-foreground">{card.back}</p>
              <p className="text-[11px] text-muted-foreground mt-3">Tap to flip back</p>
            </div>
          </div>
        </button>
      </div>

      {/* Progress dots — where you are in the deck at a glance (capped so a
          100-card deck doesn't render a dot carpet). */}
      {count > 1 && count <= 20 && (
        <div className="flex items-center justify-center gap-1 mb-3">
          {shuffled.map((_, i) => (
            <span key={i} className={`rounded-full transition-all duration-micro ${i === index ? 'w-3 h-1.5 bg-primary' : 'w-1.5 h-1.5 bg-muted'}`} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button onClick={prev}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <ChevronLeft className="w-4 h-4" /> Prev
        </button>
        <button onClick={() => setFlipped(!flipped)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-primary hover:bg-primary/10 transition-colors">
          <RotateCw className="w-3.5 h-3.5" /> Flip
        </button>
        <button onClick={next}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground text-center mt-2 hidden sm:block">Arrow keys to move · space to flip</p>
    </div>
  );
}
