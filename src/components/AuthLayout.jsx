import React from "react";
import { Check } from "lucide-react";
import { BRAND_MARK_URL } from "@/lib/brand";

/**
 * Auth shell for Login, Register, Forgot-/Reset-password and the OAuth consent
 * screens.
 *
 * The background is a scattered field of pilcrows — the brandmark repeated
 * small, like a manuscript page marked up by a scribe. It replaces the old
 * treatment (one huge brandmark blurred behind the form), which worked for the
 * Cedar graduation cap because that shape had enough internal detail to blur
 * into something atmospheric. The pilcrow is a simple two-stem glyph and blurs
 * into a shapeless smudge, so it is tiled instead of magnified.
 *
 * It is also cheaper than what it replaces: the field is one inline SVG in a
 * data URI and the glow and vignette are gradients, so nothing blocks paint.
 * The old version fetched a PNG before the form could render.
 *
 * Layer order, bottom to top: flat navy, brand glow, mark field, vignette.
 */

// The mark, tiled at low opacity. Geometry matches public/logo-mark.png
// exactly: a 150-unit lobe and a 74-unit stem.
const FIELD = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="150" height="190" viewBox="0 0 150 190">` +
    `<g fill="#2E66FF" fill-opacity="0.075">` +
      `<g transform="translate(30 18) scale(0.075) rotate(-4)">` +
        `<circle cx="0" cy="0" r="150"/>` +
        `<rect x="88" y="-128" width="74" height="598" rx="37"/>` +
        `<rect x="-52" y="-70" width="74" height="540"/>` +
      `</g>` +
      `<g transform="translate(112 112) scale(0.062) rotate(5)">` +
        `<circle cx="0" cy="0" r="150"/>` +
        `<rect x="88" y="-128" width="74" height="598" rx="37"/>` +
        `<rect x="-52" y="-70" width="74" height="540"/>` +
      `</g>` +
    `</g>` +
  `</svg>`,
);

const TRUST = ["Records & transcribes", "Summaries & flashcards", "Private to you"];

// eslint-disable-next-line no-unused-vars -- icon is accepted for API stability; the brandmark is the hero
export default function AuthLayout({ icon = undefined, title, subtitle = "", footer = null, children = null }) {
  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col" style={{ backgroundColor: "#0B0E16" }}>
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none select-none">
        {/* Brand glow, so the card sits in light rather than on flat black */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 50% 42%, rgba(30,58,138,0.55) 0%, rgba(11,14,22,0) 70%)",
          }}
        />
        {/* The field */}
        <div
          className="absolute inset-0"
          style={{ backgroundImage: `url("data:image/svg+xml,${FIELD}")`, backgroundRepeat: "repeat" }}
        />
        {/* Vignette, pulling the edges down so the form is the focal point */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 62% 58% at 50% 45%, rgba(11,14,22,0) 30%, rgba(11,14,22,0.85) 78%, #0B0E16 100%)",
          }}
        />
      </div>

      <div className="relative flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img
              src={BRAND_MARK_URL}
              alt="Praelecta"
              className="h-16 w-auto mx-auto mb-4 drop-shadow-[0_10px_28px_rgba(46,102,255,0.45)]"
            />
            <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-white text-balance">{title}</h1>
            {subtitle && <p className="text-sm text-white/60 mt-2">{subtitle}</p>}
          </div>

          <div className="bg-card rounded-3xl shadow-3 ring-1 ring-white/10 p-6 sm:p-8">{children}</div>

          {footer && <p className="text-center text-sm text-white/70 mt-6">{footer}</p>}

          <div className="hidden sm:flex items-center justify-center gap-5 mt-8">
            {TRUST.map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-xs text-white/40">
                <Check className="w-3.5 h-3.5 text-white/60" strokeWidth={2.5} />
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <p className="relative text-center text-[11px] text-white/30 pb-6 px-4">
        Made in Canada &middot; Your recordings stay private to you
      </p>
    </div>
  );
}
