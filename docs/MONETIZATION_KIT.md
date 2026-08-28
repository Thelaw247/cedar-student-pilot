# Monetization kit

The four client pieces that carry every upsell (research: MON-04). Server
enforcement is untouched — credits are still checked and billed exclusively
in `server/lib/credits.js`; everything here is presentation.

| Piece | File | Role |
| --- | --- | --- |
| `useBalance()` | `src/hooks/useBalance.js` | One shared CreditBalance fetch for all surfaces; refreshes on `cedar-data-changed` and window focus. Also exports `availableCredits()`. |
| `UpgradeProvider` / `useUpgrade()` | `src/components/monetization/UpgradeContext.jsx` | Mounted once in `Layout`; `openUpgrade({ source })` opens the single sheet anywhere. |
| `UpgradeSheet` | `src/components/monetization/UpgradeSheet.jsx` | The one paywall sheet: entry-aware headline (`ENTRY_COPY`), semester default with the billed total always shown, Scholar highlighted, packs demoted to a link, reassurance strip. Hides tiers at or below the user's current tier. |
| `CreditMeter` | `src/components/monetization/CreditMeter.jsx` | The header pill (desktop sidebar today; Home header on mobile in phase C). Amber under 10 credits, red at 0; tap opens the sheet with the matching framing. |
| `LockedFeature` | `src/components/monetization/LockedFeature.jsx` | Locked-but-visible tease card. Pass real output as children to get the blurred-preview treatment; otherwise renders value copy. |
| `startCheckout()` | `src/lib/checkout.js` | The one way any surface begins Stripe checkout. |

Rules the kit enforces by construction:

- **One sheet.** New upsell moments add an `ENTRY_COPY` entry and call
  `openUpgrade({ source })` — never a bespoke modal.
- **Sources in use:** `generic · meter · out-of-credits · handbook ·
  recording · schedule · history · onboarding`.
- **Honesty invariants:** billed totals are always as prominent as per-month
  framing; the close button is always visible; no urgency theater; packs are
  never presented as equals to plans.
- The design decision to fold the out-of-credits modal into the sheet (one
  surface, one test point) supersedes the four-component split in MON-04.

Server note: `tiers.js` remains the display-side single source of truth for
prices/copy; `createCheckoutSession` resolves real Stripe prices server-side.

## First-run onboarding (`/welcome`)

`src/pages/Onboarding.jsx` — the onboarding-primed paywall (MON-04 §2).
Reached once, after signup completes (`Register` redirects there unless an
explicit `?returnTo=` exists; Login never does). Three steps, all skippable:

1. **Goal capture** — the student names their struggle; stored as
   `cedar-goal` in localStorage (client-side only, no schema change) and
   reused by the UpgradeSheet to personalize its generic entry copy.
2. **Promise + trust** — the mechanism answered in their own terms, plus the
   honest trust block (privacy, integrity, consent). No invented
   testimonials or ratings — swap in real ones once they exist.
3. **Plan** — Student ("Most popular" here: it is the natural first plan for
   a brand-new user; the full pricing page highlights Scholar for
   upgraders) and Scholar, semester default, billed total beside the
   per-month price, and a full-width unshamed **Continue with Free** that
   lands on `/setup` — the activation moment.

`cedar-onboarded` marks completion; the flow is only auto-entered from
signup, so revisits are possible but never forced.
