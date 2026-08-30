import React from "react";
import { Check } from "lucide-react";
import { BRAND_MARK_URL } from "@/lib/brand";

/**
 * Auth shell for Login, Register, Forgot-/Reset-password and the OAuth consent
 * screens.
 *
 * The background is a photographic waveform — hundreds of fine vertical lines
 * of varying height, loud at the left and right edges and falling to near
 * black through the middle. It says what the product does without a word of
 * copy: this is a thing that listens.
 *
 * It replaces a CSS field of tiled pilcrows. That version cost nothing to
 * load, but at any real size the marks read as blobs rather than glyphs and
 * the tile grid was visible once you noticed it.
 *
 * The image is WebP at 17KB. #0B0E16 is painted underneath, so the form is
 * legible from the first paint whether or not the image has arrived, and the
 * page never flashes.
 *
 * Layer order, bottom to top: flat navy, waveform, brand glow, vignette. The
 * vignette is deliberately weak — a strong one swallowed the waveform at the
 * edges, which is the only place it exists.
 */

const TRUST = ["Records & transcribes", "Summaries & flashcards", "Private to you"];

// eslint-disable-next-line no-unused-vars -- icon is accepted for API stability; the brandmark is the hero
export default function AuthLayout({ icon = undefined, title, subtitle = "", footer = null, children = null }) {
  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col" style={{ backgroundColor: "#0B0E16" }}>
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none select-none">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'url("/auth-bg.webp")',
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        {/* Brand glow, so the card sits in light rather than on flat black */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 55% 45% at 50% 44%, rgba(30,58,138,0.38) 0%, rgba(11,14,22,0) 72%)",
          }}
        />
        {/* Vignette, kept light so the waveform survives at the edges */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 78% 72% at 50% 46%, rgba(11,14,22,0) 45%, rgba(11,14,22,0.45) 82%, rgba(11,14,22,0.8) 100%)",
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
