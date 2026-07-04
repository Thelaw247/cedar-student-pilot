import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCw, Shuffle } from 'lucide-react';

export default function FlashcardViewer({ flashcards }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shuffled, setShuffled] = useState(flashcards);

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

  const next = () => { setIndex((index + 1) % shuffled.length); setFlipped(false); };
  const prev = () => { setIndex((index - 1 + shuffled.length) % shuffled.length); setFlipped(false); };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-muted-foreground tabular-nums">{index + 1} / {shuffled.length}</p>
        <button onClick={shuffle} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <Shuffle className="w-3.5 h-3.5" /> Shuffle
        </button>
      </div>

      <div className="[perspective:1000px] mb-4">
        <button onClick={() => setFlipped(!flipped)}
          className="relative w-full min-h-[180px] rounded-xl transition-transform duration-300 [transform-style:preserve-3d]"
          style={{ transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}>
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 flex items-center justify-center p-6 [backface-visibility:hidden]">
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Question</p>
              <p className="text-base font-medium text-foreground">{card.front}</p>
              <p className="text-[10px] text-muted-foreground mt-3">Tap to flip</p>
            </div>
          </div>
          <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center p-6 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <div className="text-center">
              <p className="text-[10px] text-emerald-600 uppercase tracking-wide mb-2">Answer</p>
              <p className="text-sm text-foreground">{card.back}</p>
              <p className="text-[10px] text-muted-foreground mt-3">Tap to flip back</p>
            </div>
          </div>
        </button>
      </div>

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
    </div>
  );
}