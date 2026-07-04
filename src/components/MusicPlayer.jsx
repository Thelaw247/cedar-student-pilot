import React, { useState } from 'react';
import { X, Music, Plus, Apple, Trash2, Play } from 'lucide-react';

const stations = [
  {
    name: 'Classical',
    tracks: [
      { title: 'Bach — Cello Suite No. 1', videoId: '1prweTlAqV4' },
      { title: 'Chopin — Nocturne Op. 9 No. 2', videoId: 't28PhBSqsZo' },
      { title: 'Debussy — Clair de Lune', videoId: 'ZIsQP4wOJ9c' },
      { title: 'Mozart — Piano Concerto No. 21', videoId: 'tDQt5q9N7Cs' },
      { title: 'Beethoven — Moonlight Sonata', videoId: '4Tr0otuiQuU' },
    ],
  },
  {
    name: 'Lofi',
    tracks: [
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
  const [customTracks, setCustomTracks] = useState(() => {
    try {
      const saved = localStorage.getItem('cedar-custom-music');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const playTrack = (videoId, title) => {
    setCurrentVideoId(videoId);
    setCurrentTitle(title);
  };

  const addCustomTrack = () => {
    const videoId = extractYouTubeId(customUrl.trim());
    if (!videoId) {
      alert('Please enter a valid YouTube URL (e.g. https://youtube.com/watch?v=...)');
      return;
    }
    const track = { title: `Custom Track ${customTracks.length + 1}`, videoId };
    const updated = [...customTracks, track];
    setCustomTracks(updated);
    localStorage.setItem('cedar-custom-music', JSON.stringify(updated));
    setCustomUrl('');
    playTrack(videoId, track.title);
  };

  const removeCustomTrack = (index) => {
    const updated = customTracks.filter((_, i) => i !== index);
    setCustomTracks(updated);
    localStorage.setItem('cedar-custom-music', JSON.stringify(updated));
  };

  const appleMusicSearch = encodeURIComponent(currentTitle || 'lofi study beats');

  return (
    <div className="fixed bottom-6 right-6 w-96 max-w-[calc(100vw-3rem)] rounded-2xl border border-border bg-card p-4 shadow-xl animate-fade-in z-50 max-h-[80vh] overflow-y-auto">
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
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Now playing */}
      {currentVideoId && (
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-1.5 truncate">♪ {currentTitle}</p>
          <iframe
            key={currentVideoId}
            className="w-full rounded-lg"
            height="120"
            src={`https://www.youtube.com/embed/${currentVideoId}?autoplay=1&controls=1&rel=0`}
            title={currentTitle}
            frameBorder="0"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowFullScreen
          />
        </div>
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
            Want lofi fruits or chill edits? Add them in the "My Music" tab.
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
    </div>
  );
}