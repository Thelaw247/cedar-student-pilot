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

## The widget grammar (UI redesign, Aug 2026)

Full rationale and the per-page fix ledger live in the Design Blueprint
artifact (see MIGRATION_AUDIT.md). The parts that are now code:

- `src/components/ui/Widget.jsx` — the one card grammar: icon chip, title,
  meta summary line, optional collapse (state persisted per user under
  `localStorage cedar-w-<storageKey>`), `WidgetRow` for the standard row
  anatomy (class-color rail, title/meta, right-aligned tabular content).
  New surfaces MUST use Widget/WidgetRow instead of hand-rolling
  `rounded-xl border bg-card` markup.
- `src/components/ui/IconChip.jsx` — the tinted icon box, sizes sm/md/lg on
  the concentric radius ladder. Class-colored via `classTint()`.
- `src/lib/time.js` — the only place clock math lives (parse/format/countdown/
  clock). The five per-file copies are being deleted as pages migrate.
- `src/lib/eventMeta.js` — event types are distinguished by icon + label,
  never by an invented hue. Class + study items render in the class's own
  color; personal events render neutral; semantic colors report state only.
- `src/lib/color.js` — `classTint(color)` (color-mix) replaces every
  `color + '20'` concat.

## The recording island

Recording no longer walls off the app. The engine (segment rotation,
IndexedDB crash-safety, retrying uploads, orphan cleanup) moved verbatim from
ClassDetail's RecordModal into `src/recording/RecordingContext.jsx`, mounted
once in Layout above the router — so a session survives navigation. Its
visible handle is `src/recording/RecordingIsland.jsx`: a floating pill
(pulsing dot, tabular timer, class, pause/stop) that expands to live notes,
and that carries the whole finish flow (upload → Save & Process → processing
→ post-recording review) on whatever page the student happens to be.

Invariants:
- One session at a time; RecordModal refuses to start a second and points at
  the pill.
- The consent gate, start screen, and crash-recovery offer stay in
  ClassDetail's RecordModal — they are class-page concerns.
- `beforeunload` warns while recording; audio is still crash-safe either way.
- Processing completion fires `cedar-data-changed`, which Home and
  ClassDetail listen to.
- The island keeps its dark surface in both themes deliberately: it reads as
  live hardware, constant on every screen.

## Redesign status (session of Aug 28, 2026)

Shipped, in order: R1 foundations (Widget/WidgetRow, IconChip, Segmented,
lib/time, lib/eventMeta, lib/color + SEMANTIC), R2 recording island,
R3 Home (SVG progress ring, flattened glance widget, segmented tabs, 30s
clock), R4 Timeline/WeeklyCalendar/Classes (color law, N+1 fix, collapsible
schedule, WeekView dead-code deletion, hoverOnlyWhenSupported), R5
ClassDetail/LectureDetail/Flashcards/ExamPrediction (segmented tabs with
counts, widgetized lecture sections, transcript reading measure, keyboard
flashcards, per-day prediction cache), R6 hex cull + Settings/Planner
widgetization + urgency-semantics fix + dead AIInsightCard removed +
UserNotRegisteredError retokened.

Still open from the Design Blueprint ledger (deliberately deferred):
- The two celebration moments (day-complete spring is partial: the ring
  closes animated; no toast yet; first-lecture-processed moment unbuilt).
- Sheet unification (one bottom-sheet/modal component) — modals still use
  their existing per-file markup, styled consistently but not shared.
- Contextual notification opt-in (UpNextCard still asks on mount — kept to
  avoid a silent feature regression; needs a designed toggle).
- FocusMode component split (tokens fixed; the 700-line file stands).
- Timeline auto-scroll-to-now (skipped: it would yank the page past the
  hero widgets on load; revisit if the day view becomes its own screen).

## Quick-access recording (Aug 2026 follow-up)

`src/recording/useQuickRecord.js` defines the one-tap rule shared by every
mic in the chrome: consent on file → the session starts immediately and the
island appears; no consent (or mic refused) → the class page's RecordModal
opens with its consent gate. The legal flow is never skipped, only the
redundant tap after it.

Surfaces: `QuickRecordCard` docked at the top of the DesktopRail (xl+ — a
real layout column beside the calendar, so it can never overlap content),
showing the in-progress class (live dot) or the next one (countdown) with a
single round mic button; ClassStatusBar (mobile sticky header + Sidebar)
uses the same hook, and hides its Record button while a session is live —
the island is the one control surface for a running recording.
