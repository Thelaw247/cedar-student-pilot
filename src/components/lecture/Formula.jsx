import React from 'react';

/**
 * A formula as the professor would write it on the board.
 *
 * The enrichment pass returns both a plain linear expression ("σ = F / A")
 * and LaTeX. This renders the plain form in a maths-flavoured monospace with
 * light typographic touches — it is exact, copyable, and needs no library
 * (the Worker's CSP is script-src 'self', so a CDN renderer is out, and a
 * bundled one would add ~280 KB to first paint for every student). The LaTeX
 * is kept in the data for a future self-hosted renderer.
 */
export default function Formula({ expression, className = '' }) {
  return (
    <div className={`overflow-x-auto py-1 ${className}`}>
      <code className="font-mono text-[17px] leading-relaxed text-foreground tracking-wide whitespace-pre">{prettify(expression)}</code>
    </div>
  );
}

// Space out operators and turn ASCII stand-ins into the real glyphs, so
// "a<=b" reads "a ≤ b" and "x^2" reads "x²" — without touching letters.
const SUPERSCRIPTS = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '-': '⁻', n: 'ⁿ' };
export function prettify(expression) {
  let s = String(expression || '').trim();
  s = s.replace(/\s*<=\s*/g, ' ≤ ').replace(/\s*>=\s*/g, ' ≥ ').replace(/\s*!=\s*/g, ' ≠ ').replace(/\s*->\s*/g, ' → ');
  s = s.replace(/\^([0-9n]|-[0-9])(?![0-9a-zA-Z])/g, (_, d) => [...d].map((c) => SUPERSCRIPTS[c] || c).join(''));
  s = s.replace(/\*/g, '·');
  s = s.replace(/\s*=\s*/g, ' = ');
  return s;
}
