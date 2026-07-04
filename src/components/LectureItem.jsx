import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { FileText, AlertCircle, Calendar, Check, UserCheck, ChevronDown, Loader2 } from 'lucide-react';

export default function LectureItem({ lecture, defaultInstructor, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [instructor, setInstructor] = useState(lecture.actual_instructor || defaultInstructor || '');
  const [saving, setSaving] = useState(false);

  const confirmed = lecture.instructor_confirmed;
  const displayInstructor = lecture.actual_instructor || defaultInstructor;

  const confirm = async () => {
    setSaving(true);
    try {
      await base44.entities.Lecture.update(lecture.id, {
        actual_instructor: instructor,
        instructor_confirmed: true,
      });
      setEditing(false);
      setExpanded(false);
      onUpdate?.();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const unconfirm = async () => {
    setSaving(true);
    try {
      await base44.entities.Lecture.update(lecture.id, {
        instructor_confirmed: false,
      });
      onUpdate?.();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Main row - clickable to lecture detail */}
      <Link to={`/lectures/${lecture.id}`}
        className="flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${lecture.is_missed ? 'bg-muted' : 'bg-primary/10'}`}>
          {lecture.is_missed ? <AlertCircle className="w-5 h-5 text-muted-foreground" /> : <FileText className="w-5 h-5 text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-foreground truncate">{lecture.ai_title || `Lecture — ${lecture.date}`}</h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            <Calendar className="w-3 h-3" /> {lecture.date}
            {lecture.duration_seconds > 0 && <span>• {Math.floor(lecture.duration_seconds / 60)} min</span>}
            {lecture.status === 'processing' && <span className="text-amber-600">• Processing...</span>}
            {lecture.is_ai_estimated && <span className="text-amber-600">• AI Estimated</span>}
          </div>
        </div>
      </Link>

      {/* Instructor confirmation bar */}
      <div className="border-t border-border px-4 py-2 flex items-center gap-2">
        {confirmed ? (
          <>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600 flex-1">
              <Check className="w-3.5 h-3.5" />
              <span className="font-medium">Taught by {displayInstructor || 'Unknown'}</span>
              {lecture.actual_instructor && defaultInstructor && lecture.actual_instructor !== defaultInstructor && (
                <span className="text-muted-foreground">(guest / substitute)</span>
              )}
            </div>
            <button onClick={() => setEditing(!editing)} className="text-xs text-muted-foreground hover:text-foreground">Change</button>
            <button onClick={unconfirm} disabled={saving} className="text-xs text-muted-foreground hover:text-foreground">Undo</button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5 text-xs text-amber-600 flex-1">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Confirm instructor: {defaultInstructor || 'Unknown'}</span>
            </div>
            <button onClick={() => { setExpanded(!expanded); setEditing(true); }}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
              Confirm <ChevronDown className="w-3 h-3" />
            </button>
          </>
        )}
      </div>

      {/* Inline instructor editor */}
      {editing && (
        <div className="border-t border-border px-4 py-3 bg-muted/20 animate-fade-in">
          <p className="text-xs text-muted-foreground mb-2">Who actually gave this lecture?</p>
          <div className="flex gap-2">
            <input type="text" value={instructor} onChange={e => setInstructor(e.target.value)} placeholder="Instructor name"
              className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" autoFocus />
            <button onClick={confirm} disabled={saving || !instructor}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Confirm
            </button>
          </div>
          {defaultInstructor && (
            <button onClick={() => { setInstructor(defaultInstructor); }}
              className="text-xs text-muted-foreground hover:text-foreground mt-2">
              Use class default ({defaultInstructor})
            </button>
          )}
        </div>
      )}
    </div>
  );
}