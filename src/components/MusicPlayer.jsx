import React, { useState, useRef } from 'react';
import { X, Music, Plus, Apple, Trash2, Play, Pause, Square, ExternalLink } from 'lucide-react';

// Video IDs supplied and confirmed playable by the user. If one ever starts
// showing "Video unavailable" it means the upload was removed or its owner
// turned off third-party embedding — nothing here can override that, which is
// why every track also offers an "Open on YouTube" link.
const stations = [
  {
    name: 'Classical',
    tracks: [
      { title: 'Bach — Cello Suites No. 1–3', videoId: 'z89qUzN3vmU' },
      { title: 'Chopin — Nocturne Op. 9 No. 2', videoId: '9E6b3swbnWg' },
      { title: 'Debussy — Clair de Lune', videoId: 'WNcsUNKlAKw' },
      { title: 'Mozart — Piano Concerto No. 1', videoId: 'as-Dl7t3rfk' },
      { title: 'Beethoven — Moonlight Sonata', videoId: '4Tr0otuiQuU' },
    ],
  },
  {
    name: 'Lofi',
    tracks: [
      { title: 'Lofi Fruits — Pop Covers', videoId: 'aC3K-AqUZyo' },
      { title: 'Lofi Girl — Live Radio', videoId: 'jfKfPfyJRdk' },
    ],
  },
];

function extractYouTubeId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const match = url.match(p);
    if (match) return match[1];
  }
  return null;
}

export default function MusicPlayer({ onClose }) {
  const [tab, setTab] = useState('stations');
  const [activeStation, setActiveStation] = useState(0);
  const [currentVideoId, setCurrentVideoId] = useState(null);
  const [currentTitle, setCurrentTitle] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  // Which saved track is being renamed, and its in-progress name.
  const [editingIndex, setEditingIndex] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  // Collapsed = track list hidden, playback continues in a compact bar.
  const [collapsed, setCollapsed] = useState(false);
  const [paused, setPaused] = useState(false);
  const iframeRef = useRef(null);
  const [customTracks, setCustomTracks] = useState(() => {
    try {
      const saved = localStorage.getItem('cedar-custom-music');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  /**
   * Drive the embedded player without loading YouTube's IFrame API script.
   * The embed URL carries `enablejsapi=1`, which accepts these commands over
   * postMessage. Playback state is tracked locally: the iframe is cross-origin,
   * so we can't read it back, only command it.
   */
  const command = (func) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*');
    } catch { /* embed not ready yet — ignore */ }
  };

  const playTrack = (videoId, title) => {
    setCurrentVideoId(videoId);
    setCurrentTitle(title);
    setPaused(false);
    setCollapsed(false);
  };

  const togglePause = () => {
    command(paused ? 'playVideo' : 'pauseVideo');
    setPaused(!paused);
  };

  // Stop ends playback and dismisses the player entirely.
  const stop = () => {
    command('stopVideo');
    setCurrentVideoId(null);
    setCurrentTitle('');
    setPaused(false);
    onClose();
  };

  /**
   * The ✕ dismisses the track list. If something is playing it collapses to
   * the mini bar so the music keeps going — closing outright would unmount the
   * iframe and cut the audio. With nothing playing there's nothing to preserve,
   * so it just closes.
   */
  const handleDismiss = () => {
    if (currentVideoId) setCollapsed(true);
    else onClose();
  };

  const persist = (updated) => {
    setCustomTracks(updated);
    localStorage.setItem('cedar-custom-music', JSON.stringify(updated));
  };

  const addCustomTrack = () => {
    const videoId = extractYouTubeId(customUrl.trim());
    if (!videoId) {
      alert('Please enter a valid YouTube URL (e.g. https://youtube.com/watch?v=...)');
      return;
    }
    // Name is optional — fall back to a numbered label so a track is never blank.
    const title = customTitle.trim() || `Custom Track ${customTracks.length + 1}`;
    persist([...customTracks, { title, videoId }]);
    setCustomUrl('');
    setCustomTitle('');
    playTrack(videoId, title);
  };

  const removeCustomTrack = (index) => {
    persist(customTracks.filter((_, i) => i !== index));
    if (editingIndex === index) setEditingIndex(null);
  };

  const startRename = (index) => {
    setEditingIndex(index);
    setEditingTitle(customTracks[index].title);
  };

  const saveRename = () => {
    if (editingIndex === null) return;
    const title = editingTitle.trim() || customTracks[editingIndex].title;
    const updated = customTracks.map((t, i) => i === editingIndex ? { ...t, title } : t);
    persist(updated);
    // Keep the now-playing label in sync if this is the track that's running.
    if (customTracks[editingIndex].videoId === currentVideoId) setCurrentTitle(title);
    setEditingIndex(null);
    setEditingTitle('');
  };

  const appleMusicSearch = encodeURIComponent(currentTitle || 'lofi study beats');
  const watchUrl = currentVideoId ? `https://www.youtube.com/watch?v=${currentVideoId}` : null;

  return (
    <div
      className={
        collapsed
          ? 'fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 shadow-xl animate-fade-in max-w-[calc(100vw-3rem)]'
          : 'fixed bottom-6 right-6 w-96 max-w-[calc(100vw-3rem)] rounded-2xl border border-border bg-card p-4 shadow-xl animate-fade-in z-50 max-h-[80vh] overflow-y-auto'
      }
    >
      {/*
        The iframe lives here in both states and is never moved in the tree —
        re-parenting it would remount it and restart the track. When collapsed
        it's pushed off-screen at full size rather than hidden or zero-sized,
        which keeps the browser playing it.
      */}
      <div className={collapsed ? 'fixed left-[-9999px] top-0 w-80 h-44 pointer-events-none' : (currentVideoId ? 'mb-3' : '')}>
        {currentVideoId && (
          <iframe
            ref={iframeRef}
            key={currentVideoId}
            className="w-full rounded-lg"
            height="120"
            src={`https://www.youtube.com/embed/${currentVideoId}?autoplay=1&controls=1&rel=0&enablejsapi=1`}
            title={currentTitle}
            frameBorder="0"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>

      {collapsed ? (
        /* ---- Mini bar: pause + stop, and a way back to the list ---- */
        <>
          <button
            onClick={() => setCollapsed(false)}
            title="Show track list"
            className="flex items-center gap-2 min-w-0 pr-1 text-left"
          >
            <Music className="w-4 h-4 text-primary flex-shrink-0" />
            <span className="text-xs font-medium truncate max-w-[10rem]">{currentTitle || 'Playing'}</span>
          </button>
          <button
            onClick={togglePause}
            aria-label={paused ? 'Play' : 'Pause'}
            className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors flex-shrink-0"
          >
            {paused ? <Play className="w-3.5 h-3.5" fill="currentColor" /> : <Pause className="w-3.5 h-3.5" fill="currentColor" />}
          </button>
          <button
            onClick={stop}
            aria-label="Stop"
            className="w-8 h-8 rounded-full border border-border text-muted-foreground flex items-center justify-center hover:text-destructive hover:border-destructive/40 transition-colors flex-shrink-0"
          >
            <Square className="w-3 h-3" fill="currentColor" />
          </button>
        </>
      ) : (
        /* ---- Full panel ---- */
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">Music Player</h3>
            </div>
            <div className="flex items-center gap-2">
              <a href={`https://music.apple.com/us/search?term=${appleMusicSearch}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-card border border-border text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                <Apple className="w-3.5 h-3.5" /> Apple Music
              </a>
              <button
                onClick={handleDismiss}
                title={currentVideoId ? 'Hide (keeps playing)' : 'Close'}
                aria-label={currentVideoId ? 'Hide player, keep playing' : 'Close player'}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Now playing */}
          {currentVideoId && (
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs text-muted-foreground truncate">♪ {currentTitle}</p>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button onClick={togglePause}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                  {paused ? <><Play className="w-3 h-3" /> Play</> : <><Pause className="w-3 h-3" /> Pause</>}
                </button>
                <button onClick={stop}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border text-[11px] font-medium text-muted-foreground hover:text-destructive transition-colors">
                  <Square className="w-2.5 h-2.5" /> Stop
                </button>
              </div>
            </div>
          )}

          {/* Escape hatch — some YouTube videos block embedding, which shows
              "Video unavailable" inside the frame. That can't be detected from
              here (the iframe is cross-origin), so the link is always offered. */}
          {watchUrl && (
            <a href={watchUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground mb-3">
              <ExternalLink className="w-2.5 h-2.5" /> Won’t play? Open on YouTube
            </a>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mb-3">
            <button onClick={() => setTab('stations')}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'stations' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              Stations
            </button>
            <button onClick={() => setTab('custom')}
              className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'custom' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              My Music
            </button>
          </div>

          {/* Stations tab */}
          {tab === 'stations' && (
            <div>
              <div className="flex gap-1.5 flex-wrap mb-2">
                {stations.map((s, i) => (
                  <button key={i} onClick={() => setActiveStation(i)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${activeStation === i ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                    {s.name}
                  </button>
                ))}
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-hide">
                {stations[activeStation].tracks.map((t, i) => (
                  <button key={i} onClick={() => playTrack(t.videoId, t.title)}
                    className={`w-full text-left px-2.5 py-2 rounded-md text-xs flex items-center gap-2 transition-colors ${currentVideoId === t.videoId ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                    <Play className="w-3 h-3 flex-shrink-0" fill={currentVideoId === t.videoId ? 'currentColor' : 'none'} />
                    <span className="truncate">{t.title}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2 text-center">
                Some tracks block embedding and won’t play here. Add your own in “My Music”.
              </p>
            </div>
          )}

          {/* Custom tab */}
          {tab === 'custom' && (
            <div>
              <div className="flex gap-2 mb-3">
                <input type="text" placeholder="Paste YouTube URL..." value={customUrl}
                  onChange={e => setCustomUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomTrack()}
                  className="flex-1 px-2.5 py-2 rounded-md border border-input bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
                <button onClick={addCustomTrack}
                  className="px-2.5 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 flex items-center justify-center">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              {customTracks.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6 px-4">
                  Add your favorite YouTube tracks — lofi fruits, chill edits, or anything else — by pasting the URL above.
                </p>
              ) : (
                <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-hide">
                  {customTracks.map((t, i) => (
                    <div key={i} className="flex items-center gap-1">
                      <button onClick={() => playTrack(t.videoId, t.title)}
                        className={`flex-1 text-left px-2.5 py-2 rounded-md text-xs flex items-center gap-2 transition-colors ${currentVideoId === t.videoId ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
                        <Play className="w-3 h-3 flex-shrink-0" fill={currentVideoId === t.videoId ? 'currentColor' : 'none'} />
                        <span className="truncate">{t.title}</span>
                      </button>
                      <button onClick={() => removeCustomTrack(i)}
                        className="text-muted-foreground hover:text-destructive p-1.5 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
