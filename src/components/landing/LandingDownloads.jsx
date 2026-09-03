import React from 'react';
import { Download, Laptop, Mic, RefreshCw, ShieldQuestion } from 'lucide-react';
import { DESKTOP_DOWNLOADS, DESKTOP_RELEASES_URL, detectDesktopOs, isRunningInDesktopApp } from '@/lib/desktopDownloads';

const perks = [
  { icon: Mic, title: 'Record from your laptop', body: 'Lecture halls with a laptop on the desk, online classes, a recorded Zoom: press record on the machine you are already using.' },
  { icon: RefreshCw, title: 'Same account everywhere', body: 'Recorded it on your phone? It is on your laptop by the time you sit down. Nothing to sync, nothing to export.' },
  { icon: Laptop, title: 'Its own window', body: 'A dock icon and a window that stays where you put it. No tab to lose ten minutes into a lecture.' },
];

export default function LandingDownloads() {
  const inDesktop = isRunningInDesktopApp();
  const current = detectDesktopOs();
  const ordered = [...DESKTOP_DOWNLOADS].sort((a, b) => Number(b.id.startsWith(current || '~')) - Number(a.id.startsWith(current || '~')));

  return (
    <section id="download" className="px-4 py-20 sm:px-6 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold text-primary">Desktop app</p>
            <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">Runs on your laptop too. Same account, no tab to lose.</h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
              Windows and Linux today, Mac shortly. Sign in once and everything you recorded is already there, and every improvement to Praelecta shows up the next time you open it, with nothing to update.
            </p>
            <div className="mt-6 space-y-4">
              {perks.map((perk) => (
                <div key={perk.title} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-primary/10 text-primary"><perk.icon className="h-4 w-4" /></div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{perk.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{perk.body}</p>
                  </div>
                </div>
              ))}
            </div>
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
                {current === 'mac' && (
                  <p className="mt-4 rounded-xl border border-border bg-muted/60 px-4 py-3 text-xs leading-5 text-muted-foreground">
                    <span className="font-semibold text-foreground">The Mac app is not out yet.</span> It is built and waiting on a
                    round of testing on a real Mac before we hand it to anyone. Praelecta runs fully in your browser in the meantime.
                  </p>
                )}
                <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                  <ShieldQuestion className="mt-0.5 h-4 w-4 flex-none text-primary" />
                  <span>
                    <span className="font-semibold text-foreground">If Windows or your antivirus warns you:</span> the app is not signed
                    with a paid certificate yet, and unsigned installers from a small publisher get flagged on sight. Choose
                    &ldquo;More info&rdquo; then &ldquo;Run anyway&rdquo;, or download the <span className="font-semibold text-foreground">zip</span> instead — same app,
                    no installer, far less likely to be blocked.{' '}
                    <a href={DESKTOP_RELEASES_URL} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:text-foreground">Checksums</a>
                  </span>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
