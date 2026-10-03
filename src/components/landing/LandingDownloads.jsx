import React from 'react';
import { Download, Globe, Laptop, ShieldQuestion, Smartphone } from 'lucide-react';
import { DESKTOP_DOWNLOADS, DESKTOP_RELEASES_URL, detectDesktopOs, isRunningInDesktopApp } from '@/lib/desktopDownloads';

/**
 * Where it runs, as a strip a visitor can read in one glance: the browser
 * on any phone, the desktop apps, and the iPhone app still on the way — the
 * true version of the "Web · iOS · Android" line, so nobody has to find the
 * answer in the FAQ.
 */
export const DEVICES = [
  { icon: Globe, label: 'Web', note: 'any phone or laptop' },
  { icon: Smartphone, label: 'iPhone and Android', note: 'in the browser today' },
  { icon: Laptop, label: 'Windows, Mac and Linux', note: 'desktop apps' },
];

/**
 * An honest "coming soon" marker, not a download link — there is nothing
 * to tap yet, so it is a static pill rather than a dead button. Becomes a
 * real App Store link once the iOS app ships.
 */
function IphoneComingSoon() {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-border px-3.5 py-2 text-xs font-medium text-muted-foreground">
      <svg viewBox="0 0 384 512" aria-hidden="true" className="h-3.5 w-3.5 fill-current text-foreground/70">
        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
      </svg>
      iPhone app coming to the App Store
    </span>
  );
}

/**
 * The desktop section: the device strip, one heading, one line, and the
 * download buttons for the visitor's own machine first.
 */
export default function LandingDownloads() {
  const inDesktop = isRunningInDesktopApp();
  const current = detectDesktopOs();
  const ordered = [...DESKTOP_DOWNLOADS].sort((a, b) => Number(b.id.startsWith(current || '~')) - Number(a.id.startsWith(current || '~')));

  return (
    <section id="download" className="px-4 py-16 sm:px-6 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <h2 className="text-balance text-4xl font-bold tracking-[-0.045em] text-foreground sm:text-5xl">Runs on your laptop too.</h2>
            <p className="mt-4 max-w-xl text-lg leading-8 text-muted-foreground">
              Sign in once and everything you recorded is already there, on whichever machine you sit down at.
            </p>
            <ul className="mt-6 flex flex-wrap items-center gap-2" aria-label="Where Praelecta runs">
              {DEVICES.map((d) => (
                <li key={d.label} className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3.5 py-2 text-xs font-semibold text-foreground/85">
                  <d.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  {d.label}
                  <span className="font-medium text-muted-foreground">· {d.note}</span>
                </li>
              ))}
              <li><IphoneComingSoon /></li>
            </ul>
          </div>

          <div className="rounded-[26px] border border-border bg-card p-6 sm:p-8">
            {inDesktop ? (
              <div className="text-center">
                <Laptop className="mx-auto h-8 w-8 text-primary" />
                <p className="mt-3 text-base font-semibold text-foreground">You are already in the desktop app.</p>
                <p className="mt-1 text-sm text-muted-foreground">Nothing to download here.</p>
              </div>
            ) : (
              <>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Download</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {ordered.map((d, index) => {
                    const primary = index === 0 && current;
                    return (
                      <a
                        key={d.id}
                        href={d.url}
                        className={primary
                          ? 'auth-cta flex items-center gap-3 rounded-2xl px-4 py-3.5 text-primary-foreground transition-all hover:-translate-y-0.5 sm:col-span-2'
                          : 'flex items-center gap-3 rounded-2xl border border-border bg-muted/60 px-4 py-3.5 text-foreground transition-colors hover:bg-muted'}
                      >
                        <Download className="h-4 w-4 flex-none" />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{primary ? `Download for ${d.label}` : d.label}</span>
                          <span className={`block text-xs ${primary ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{d.note}</span>
                        </span>
                      </a>
                    );
                  })}
                </div>
                {/* The warning this visitor will actually meet: a Mac blocks the
                    first open of an app Apple has not notarized, Windows flags an
                    unsigned installer. */}
                <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                  <ShieldQuestion className="mt-0.5 h-4 w-4 flex-none text-primary" />
                  {current === 'mac' ? (
                    <span>
                      <span className="font-semibold text-foreground">If your Mac won&rsquo;t open it:</span> the app is not notarized
                      by Apple yet, so macOS stops the first open. Try opening it once, then go to System Settings, Privacy &amp; Security,
                      and choose &ldquo;Open Anyway&rdquo;. After that it opens normally.{' '}
                      <a href={DESKTOP_RELEASES_URL} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:text-foreground">Checksums</a>
                    </span>
                  ) : (
                    <span>
                      <span className="font-semibold text-foreground">If Windows or your antivirus warns you:</span> the app is not signed
                      with a paid certificate yet, and unsigned installers from a small publisher get flagged on sight. Choose
                      &ldquo;More info&rdquo; then &ldquo;Run anyway&rdquo;, or download the <span className="font-semibold text-foreground">zip</span> instead: the same
                      app with no installer, which security tools are less likely to stop.{' '}
                      <a href={DESKTOP_RELEASES_URL} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:text-foreground">Checksums</a>
                    </span>
                  )}
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
