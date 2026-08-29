import React from "react";
import { Check } from "lucide-react";

/**
 * Auth shell for Login, Register, Forgot-/Reset-password and the OAuth
 * consent screens (Aug 2026 glass redesign). One constant visual world in
 * both themes — like the recording island: the glass brandmark blown up to
 * fill the viewport, heavily blurred and darkened, with the crisp mark and
 * the form card floating on top. Pure presentation: every page's form logic
 * is untouched, and the card interior keeps theme tokens so the forms render
 * correctly in light and dark.
 *
 * Assets (public/): logo-glass-160.png is the crisp transparent brandmark;
 * logo-glass-blur-512.png is a palette-quantized copy used only as background
 * art — the heavy blur hides the quantization, and it keeps the page light.
 */
const TRUST = ["Records & transcribes", "Summaries & flashcards", "Private to you"];

// eslint-disable-next-line no-unused-vars -- icon is accepted for API stability; the glass brandmark is the hero now
export default function AuthLayout({ icon = undefined, title, subtitle = "", footer = null, children = null }) {
  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col" style={{ backgroundColor: "#0B0E16" }}>
      {/* Background: the brandmark over the whole screen, blurred and darkened */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none select-none">
        <img
          src="/logo-glass-blur-512.png"
          alt=""
          className="absolute left-1/2 top-1/2 w-[115vmax] max-w-none -translate-x-1/2 -translate-y-1/2 rotate-[8deg] blur-[70px] opacity-50"
        />
        {/* Darkening + vignette so the form stays the focal point */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 50% 38%, rgba(11,14,22,0.45) 0%, rgba(11,14,22,0.82) 68%, rgba(11,14,22,0.94) 100%)",
          }}
        />
        {/* Faint dot grid for texture, faded out toward the edges */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            maskImage: "radial-gradient(ellipse at 50% 40%, black 0%, transparent 72%)",
            WebkitMaskImage: "radial-gradient(ellipse at 50% 40%, black 0%, transparent 72%)",
          }}
        />
      </div>

      <div className="relative flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <img
              src="/logo-glass-160.png"
              alt="Cedar"
              className="w-16 h-16 mx-auto mb-4 drop-shadow-[0_10px_28px_rgba(46,102,255,0.45)]"
            />
            <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-white text-balance">{title}</h1>
            {subtitle && <p className="text-sm text-white/60 mt-2">{subtitle}</p>}
          </div>

          <div className="bg-card rounded-3xl shadow-3 ring-1 ring-white/10 p-6 sm:p-8">
            {children}
          </div>

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
