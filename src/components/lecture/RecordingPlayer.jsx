import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, RotateCcw, RotateCw, Loader2, ChevronUp, Headphones } from 'lucide-react';
import { formatClock } from '@/lib/time';
import { getSetting, setSetting } from '@/lib/settings';

/**
 * The recording, played back with the app's own controls.
 *
 * It was the browser's <audio controls>: a white pill on the dark theme, no
 * way to speed it up, no skip, and nothing remembered between visits. And
 * three things it could not do at all:
 *
 *   - A recording longer than ninety minutes is stored in parts
 *     (RecordingContext rotates segments), and only part one ever played.
 *   - The signed playback URL lasts a fixed time (server/lib/r2.js). The
 *     browser fetches a long recording in pieces as it plays, so a listen
 *     that outlived the URL stalled with a network error and no way on.
 *   - A MediaRecorder webm carries no duration in its header, so the browser
 *     reports Infinity until it has read to the end: "0:00 / ∞", and a
 *     scrubber that cannot be dragged.
 *
 * What this does instead: one <audio> element driven by these controls; the
 * parts played in order, each resolved to a URL when its turn comes; a new
 * URL fetched and the position restored when playback errors; the duration
 * forced out of a header-less webm (seek far past the end once, which makes
 * the browser read the file's real length), with the lecture row's own
 * duration_seconds as the figure shown until then; the playback speed kept
 * in Settings; the position kept per lecture, so a lecture opened again
 * starts where it was left; the phone's lock-screen controls wired through
 * the Media Session API; and a small bar pinned to the bottom of the screen
 * while the recording plays and the player itself has scrolled away, so
 * reading the transcript does not mean losing the pause button.
 *
 * Props:
 *   lectureId   for the remembered position
 *   refs        the recording's storage refs in order (recording_url, or
 *               recording_parts when there are several)
 *   resolveUrl  ref -> Promise<string>: a fresh signed URL (files.getDownloadUrl)
 *   duration    the lecture's duration_seconds, if known
 *   title       what the lock screen and the mini bar call it
 *   subtitle    the class name, for the same
 */
const RATES = [1, 1.25, 1.5, 1.75, 2];
const SKIP_BACK = 15;
const SKIP_FORWARD = 30;
const POSITION_KEY = (id) => `cedar-play-pos-${id}`;
const FAR_PAST_THE_END = 1e101;

function readPosition(lectureId) {
  try {
    const raw = localStorage.getItem(POSITION_KEY(lectureId));
    if (!raw) return null;
    const saved = JSON.parse(raw);
    return Number.isFinite(saved?.t) && saved.t > 5 ? { t: saved.t, part: Number(saved.part) || 0 } : null;
  } catch { return null; }
}

function writePosition(lectureId, t, part) {
  try { localStorage.setItem(POSITION_KEY(lectureId), JSON.stringify({ t: Math.floor(t), part, at: Date.now() })); } catch { /* cosmetic */ }
}

function clearPosition(lectureId) {
  try { localStorage.removeItem(POSITION_KEY(lectureId)); } catch { /* cosmetic */ }
}

export default function RecordingPlayer({ lectureId, refs = [], resolveUrl, duration = null, title = 'Recording', subtitle = '' }) {
  const audioRef = useRef(null);
  const cardRef = useRef(null);
  const [part, setPart] = useState(() => Math.min(readPosition(lectureId)?.part || 0, Math.max(0, refs.length - 1)));
  const [src, setSrc] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [current, setCurrent] = useState(0);
  const [length, setLength] = useState(null);       // seconds, once the browser knows
  const [rate, setRate] = useState(() => {
    const saved = Number(getSetting('playbackRate'));
    return RATES.includes(saved) ? saved : 1;
  });
  const [resumedFrom, setResumedFrom] = useState(null);
  const [offscreen, setOffscreen] = useState(false);
  // Where to land once the source is ready: the remembered position on the
  // first load, the old position after a URL refresh, zero for a new part.
  const pendingSeekRef = useRef(null);
  const resumeAfterRefreshRef = useRef(false);
  const retriesRef = useRef(0);
  const probingDurationRef = useRef(false);
  const lastSavedRef = useRef(0);

  const parts = refs.length;
  const ref = refs[part];

  // On the first load only, land where the student left off.
  const firstLoadRef = useRef(true);
  useEffect(() => {
    if (!firstLoadRef.current) return;
    firstLoadRef.current = false;
    const saved = readPosition(lectureId);
    if (saved && (saved.part || 0) === part) {
      pendingSeekRef.current = saved.t;
      setResumedFrom(saved.t);
    }
  }, [lectureId, part]);

  // Resolve the current part to a URL; again on `nonce` after an error.
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let cancelled = false;
    if (!ref) { setSrc(null); return undefined; }
    setLoadError(null);
    setSrc(null);
    setLength(null);
    Promise.resolve(resolveUrl(ref))
      .then((url) => { if (!cancelled) setSrc(url || null); })
      .catch(() => { if (!cancelled) setLoadError('The recording could not be loaded.'); });
    return () => { cancelled = true; };
  }, [ref, resolveUrl, nonce]);

  // The element follows the chosen speed, whatever source is loaded.
  useEffect(() => {
    const a = audioRef.current;
    if (a) a.playbackRate = rate;
  }, [rate, src]);

  const shownLength = length ?? (Number(duration) > 0 && parts === 1 ? Number(duration) : null);

  const landPendingSeek = () => {
    const a = audioRef.current;
    if (!a) return;
    const t = pendingSeekRef.current;
    pendingSeekRef.current = null;
    if (Number.isFinite(t) && t > 0) {
      try { a.currentTime = t; } catch { /* a source that cannot seek yet */ }
    }
    if (resumeAfterRefreshRef.current) {
      resumeAfterRefreshRef.current = false;
      a.play().catch(() => setPlaying(false));
    }
  };

  const onLoadedMetadata = () => {
    const a = audioRef.current;
    if (!a) return;
    a.playbackRate = rate;
    if (Number.isFinite(a.duration)) {
      setLength(a.duration);
      landPendingSeek();
    } else {
      // No duration in the header: seek far past the end, and the browser
      // reads the file to find out how long it really is (durationchange).
      probingDurationRef.current = true;
      try { a.currentTime = FAR_PAST_THE_END; } catch { /* then we show the row's figure */ }
    }
  };

  const onDurationChange = () => {
    const a = audioRef.current;
    if (!a || !Number.isFinite(a.duration)) return;
    setLength(a.duration);
    if (probingDurationRef.current) {
      probingDurationRef.current = false;
      a.currentTime = 0;
      landPendingSeek();
    }
  };

  const onTimeUpdate = () => {
    const a = audioRef.current;
    if (!a || probingDurationRef.current) return;
    setCurrent(a.currentTime);
    // Once every few seconds, not sixty times a minute.
    if (a.currentTime - lastSavedRef.current > 4 || a.currentTime < lastSavedRef.current) {
      lastSavedRef.current = a.currentTime;
      writePosition(lectureId, a.currentTime, part);
    }
  };

  const onEnded = () => {
    if (part < parts - 1) {
      // The next part, from its start, still playing.
      pendingSeekRef.current = 0;
      resumeAfterRefreshRef.current = true;
      setCurrent(0);
      setPart(part + 1);
      return;
    }
    setPlaying(false);
    clearPosition(lectureId);
  };

  const onError = () => {
    const a = audioRef.current;
    // A URL that expired mid-listen fails as a network error; a fresh one
    // picks up where it was. Two tries, then say so.
    if (retriesRef.current < 2 && src) {
      retriesRef.current += 1;
      pendingSeekRef.current = a?.currentTime || current;
      resumeAfterRefreshRef.current = playing;
      setNonce((n) => n + 1);
      return;
    }
    setPlaying(false);
    setLoadError('The recording stopped loading. Check your connection and try again.');
  };

  const tryAgain = () => {
    retriesRef.current = 0;
    pendingSeekRef.current = current;
    setNonce((n) => n + 1);
  };

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a || !src) return;
    if (a.paused) a.play().catch(() => setPlaying(false));
    else a.pause();
  }, [src]);

  const skip = useCallback((seconds) => {
    const a = audioRef.current;
    if (!a) return;
    const max = Number.isFinite(a.duration) ? a.duration : Infinity;
    a.currentTime = Math.max(0, Math.min(max, a.currentTime + seconds));
    setCurrent(a.currentTime);
  }, []);

  const seekTo = (seconds) => {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = seconds;
    setCurrent(seconds);
  };

  const cycleRate = () => {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    setRate(next);
    setSetting('playbackRate', next);
  };

  const goToPart = (index) => {
    if (index < 0 || index >= parts || index === part) return;
    pendingSeekRef.current = 0;
    resumeAfterRefreshRef.current = playing;
    setCurrent(0);
    setPart(index);
  };

  // Keys, on the player only: space, and the arrows for the two skips. Not
  // on the document, where a space in the notes box is a space.
  const onKeyDown = (e) => {
    const tag = e.target.tagName;
    if (e.key === ' ') {
      // A focused button presses itself on space; the card toggles only
      // when the space lands on the card.
      if (tag === 'BUTTON' || tag === 'INPUT') return;
      e.preventDefault(); toggle();
    } else if (e.key === 'ArrowLeft') { e.preventDefault(); skip(-SKIP_BACK); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); skip(SKIP_FORWARD); }
  };

  // The lock screen and the headphone button.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return undefined;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({ title, artist: subtitle || 'Praelecta' });
      navigator.mediaSession.setActionHandler('play', () => audioRef.current?.play().catch(() => {}));
      navigator.mediaSession.setActionHandler('pause', () => audioRef.current?.pause());
      navigator.mediaSession.setActionHandler('seekbackward', () => skip(-SKIP_BACK));
      navigator.mediaSession.setActionHandler('seekforward', () => skip(SKIP_FORWARD));
    } catch { /* an older browser */ }
    return () => {
      try {
        for (const action of ['play', 'pause', 'seekbackward', 'seekforward']) navigator.mediaSession.setActionHandler(action, null);
      } catch { /* same */ }
    };
  }, [title, subtitle, skip]);

  // The mini bar: only while playing, only once the card has scrolled away.
  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => setOffscreen(!entry.isIntersecting), { threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // While the mini bar is up it covers the last line of the page, so the
  // page gets that much room at its end (index.css, html.mini-player-open).
  const miniBar = playing && offscreen && !loadError;
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    document.documentElement.classList.toggle('mini-player-open', miniBar);
    return () => document.documentElement.classList.remove('mini-player-open');
  }, [miniBar]);

  const pct = shownLength ? Math.min(100, (current / shownLength) * 100) : 0;
  const timeLeft = shownLength ? Math.max(0, shownLength - current) : null;
  const ready = !!src && !loadError;
  const canSeek = ready && !!shownLength;
  const label = useMemo(() => `${formatClock(current)}${shownLength ? ` of ${formatClock(shownLength)}` : ''}`, [current, shownLength]);

  const playButton = (size = 'lg') => (
    <button type="button" onClick={toggle} disabled={!ready} aria-label={playing ? 'Pause' : 'Play'}
      className={`${size === 'lg' ? 'w-11 h-11' : 'w-9 h-9'} rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all duration-micro disabled:opacity-50 flex-shrink-0`}>
      {waiting && playing
        ? <Loader2 className={size === 'lg' ? 'w-5 h-5 animate-spin' : 'w-4 h-4 animate-spin'} />
        : playing
          ? <Pause className={size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} fill="currentColor" />
          : <Play className={`${size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} ml-0.5`} fill="currentColor" />}
    </button>
  );

  return (
    <>
      <div ref={cardRef} tabIndex={0} onKeyDown={onKeyDown} aria-label="Recording player"
        className="rounded-xl border border-border bg-card p-3 sm:p-4 mb-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <audio
          ref={audioRef}
          src={src || undefined}
          preload="metadata"
          onLoadedMetadata={onLoadedMetadata}
          onDurationChange={onDurationChange}
          onTimeUpdate={onTimeUpdate}
          onPlay={() => { setPlaying(true); setResumedFrom(null); }}
          onPause={() => setPlaying(false)}
          onWaiting={() => setWaiting(true)}
          onPlaying={() => setWaiting(false)}
          onCanPlay={() => setWaiting(false)}
          onEnded={onEnded}
          onError={onError}
        />

        <div className="flex items-center gap-3">
          {playButton('lg')}
          <button type="button" onClick={() => skip(-SKIP_BACK)} disabled={!ready} aria-label={`Back ${SKIP_BACK} seconds`}
            className="w-9 h-9 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all duration-micro flex items-center justify-center disabled:opacity-50 flex-shrink-0 relative">
            <RotateCcw className="w-4 h-4" />
            <span className="absolute text-[8px] font-semibold tabular-nums mt-[1px]">{SKIP_BACK}</span>
          </button>
          <button type="button" onClick={() => skip(SKIP_FORWARD)} disabled={!ready} aria-label={`Forward ${SKIP_FORWARD} seconds`}
            className="w-9 h-9 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all duration-micro flex items-center justify-center disabled:opacity-50 flex-shrink-0 relative">
            <RotateCw className="w-4 h-4" />
            <span className="absolute text-[8px] font-semibold tabular-nums mt-[1px]">{SKIP_FORWARD}</span>
          </button>

          <div className="flex-1 min-w-0">
            {loadError ? (
              <p className="text-sm text-destructive">
                {loadError}{' '}
                <button type="button" onClick={tryAgain} className="font-medium underline hover:text-foreground">Try again</button>
              </p>
            ) : !src ? (
              <p className="text-sm text-muted-foreground inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading recording…</p>
            ) : (
              <>
                <input
                  type="range"
                  min={0}
                  max={shownLength || 0}
                  step={1}
                  value={Math.min(current, shownLength || 0)}
                  disabled={!canSeek}
                  onChange={(e) => seekTo(Number(e.target.value))}
                  aria-label="Position"
                  aria-valuetext={label}
                  className="recording-scrubber w-full"
                  style={{ '--played': `${pct}%` }}
                />
                <div className="flex items-center justify-between mt-1 text-[11px] text-muted-foreground tabular-nums">
                  <span>{formatClock(current)}</span>
                  <span>{shownLength ? (timeLeft > 0 ? `${formatClock(timeLeft)} left` : formatClock(shownLength)) : 'Working out the length…'}</span>
                </div>
              </>
            )}
          </div>

          <button type="button" onClick={cycleRate} disabled={!ready} aria-label={`Playback speed ${rate} times. Change`}
            className="min-w-[44px] h-9 px-2 rounded-lg border border-border text-xs font-semibold tabular-nums text-foreground hover:bg-muted active:scale-95 transition-all duration-micro disabled:opacity-50 flex-shrink-0">
            {rate}×
          </button>
        </div>

        {(resumedFrom || parts > 1) && !loadError && (
          <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
            <span>{resumedFrom ? `Picking up at ${formatClock(resumedFrom)}` : ''}</span>
            {parts > 1 && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <button type="button" onClick={() => goToPart(part - 1)} disabled={part === 0} className="px-1.5 py-1 rounded hover:text-foreground disabled:opacity-40">Previous</button>
                Part {part + 1} of {parts}
                <button type="button" onClick={() => goToPart(part + 1)} disabled={part >= parts - 1} className="px-1.5 py-1 rounded hover:text-foreground disabled:opacity-40">Next</button>
              </span>
            )}
          </div>
        )}
      </div>

      {miniBar && (
        <div className="fixed z-30 inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-96 rounded-xl border border-border bg-card/95 glass-chrome shadow-3 px-3 py-2 flex items-center gap-3 animate-fade-in"
          role="region" aria-label="Now playing">
          {playButton('sm')}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate inline-flex items-center gap-1.5"><Headphones className="w-3 h-3 text-muted-foreground flex-shrink-0" /> {title}</p>
            <p className="text-[11px] text-muted-foreground tabular-nums">{label}</p>
          </div>
          <button type="button" onClick={() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })} aria-label="Back to the player"
            className="w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center flex-shrink-0">
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
}
