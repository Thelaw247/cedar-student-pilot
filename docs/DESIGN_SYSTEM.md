# Cedar design system

The token layer every surface draws from. Values live in exactly two files —
`src/index.css` (the CSS variables) and `tailwind.config.js` (the class
mappings) — so the whole app can be retuned without touching a page. The
research behind every choice is in the printed series document DSN-03
(Premium Design Language); this file is the working reference.

## Principles

1. **One brand hue.** `--primary` (#2E66FF light / #4D7CFF dark) is the only
   saturated accent. Semantic colors (destructive, success where used) are
   reserved for state, never decoration. If a screen needs a second accent,
   the answer is gray.
2. **Concentric radii.** One ladder: 24px modals · 20px cards · 16px mid ·
   12px buttons · 8px chips. A nested rounded element takes outer radius
   minus padding — never the same radius as its container. The raw Tailwind
   classes are mapped onto the ladder (`rounded-lg` 12 / `rounded-xl` 16 /
   `rounded-2xl` 20 / `rounded-3xl` 24), so existing markup landed on the
   system automatically; new code should prefer the semantic classes
   (`rounded-card`, `rounded-modal`, `rounded-button`, `rounded-input`,
   `rounded-chip`).
3. **Tinted, layered shadows; surfaces do elevation in dark mode.** Light
   mode uses `--shadow-1..3`: two-three layers tinted with brand navy at
   4–7% alpha. Dark mode keeps shadows minimal — elevation comes from
   lighter surface steps (`--card` sits above `--background`).
4. **Never pure black, never pure white.** Light canvas is a cool off-white;
   dark canvas is layered blue-biased dark gray (`220 16% 7%`).
5. **Type carries hierarchy through weight and gray, not size explosion.**
   Inter throughout; headings track at −0.02em, body at −0.01em (set
   globally in `index.css`).
6. **Motion is fast, eased and functional.** `--duration-micro/standard/
   modal/page` (150/250/300/400ms) with `--ease-standard`
   (`cubic-bezier(0.32, 0.72, 0, 1)`) — available as the `ease-standard`
   Tailwind utility. Entries ease out. `prefers-reduced-motion` is honored
   globally. The app has exactly two sanctioned celebration moments: the
   first processed-lecture reveal and checkout success.
7. **Glass is chrome, not content.** `.glass-chrome` (translucent card
   surface + blur/saturate, with opaque `@supports` and
   `prefers-reduced-transparency` fallbacks) is for the header, tab bar and
   sheets only — at most three glass surfaces a screen, never stacked, never
   on content cards. `.glass` remains the historical backdrop-blur helper
   for dimmed modal overlays.

## Token inventory

| Group | Tokens | Where used |
| --- | --- | --- |
| Color | `--background --foreground --card --popover --primary --secondary --muted --accent --destructive --border --input --ring` (+ `-foreground` pairs) | Everything, via the shadcn-style Tailwind mapping |
| Radius | `--radius --radius-button --radius-card --radius-input --radius-modal --radius-notification --radius-chip` | `rounded-*` classes per the ladder above |
| Shadow | `--shadow-0..3` | `shadow-1/2/3` utilities |
| Motion | `--duration-micro/standard/modal/page`, `--ease-standard` | `duration-*`, `ease-standard` |
| Fonts | `--font-heading --font-body --font-display --font-mono` | `font-heading` etc. |

## Rules of thumb when building a surface

- Card padding ≥ 20px; 44px minimum touch targets; when in doubt add space.
- Numbers that align in columns get `tabular-nums`.
- Chips/badges: outline + colored dot beats a filled tint when several
  appear together — one hue family should hold the page.
- Empty states get the one illustration style (pending owner decision №6),
  never an emoji.
- Anything interactive must look interactive; focus states stay visible.

Changed values → update this file and DSN-03's successor in the same commit.
