import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Coffee, Sparkles } from 'lucide-react';

const SUGGESTIONS = [
  { icon: BookOpen, text: "Review yesterday's lecture", link: '/classes', color: 'text-blue-500' },
  { icon: Coffee, text: 'Take a 15-minute break', link: null, color: 'text-emerald-500' },
  { icon: Sparkles, text: 'Start a study session', link: '/focus', color: 'text-purple-500' },
];

export default function EmptyTimeSuggestion({ gapStart, gapEnd, startMin, hourHeight }) {
  const top = ((gapStart - startMin) / 60) * hourHeight;
  const height = ((gapEnd - gapStart) / 60) * hourHeight;
  const gapMinutes = gapEnd - gapStart;

  const suggestion = gapMinutes >= 45 ? SUGGESTIONS[2] : gapMinutes >= 20 ? SUGGESTIONS[0] : SUGGESTIONS[1];
  const Icon = suggestion.icon;

  const content = (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground group-hover:text-primary transition-colors">
      <Icon className={`w-3 h-3 ${suggestion.color}`} strokeWidth={2} />
      {suggestion.text}
      <span className="text-muted-foreground/40 ml-0.5">· {gapMinutes}m free</span>
    </div>
  );

  return (
    <div
      className="absolute"
      style={{ top: top + 2, height: Math.max(height - 4, 20), left: '60px', right: '4px', zIndex: 1 }}
    >
      <div className="h-full rounded-lg border border-dashed border-border/60 flex items-center justify-center group hover:border-primary/40 hover:bg-primary/5 transition-all duration-standard">
        {suggestion.link ? (
          <Link to={suggestion.link} className="flex items-center">
            {content}
          </Link>
        ) : (
          content
        )}
      </div>
    </div>
  );
}