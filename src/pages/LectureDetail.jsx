import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, FileText, Clock, AlertCircle, Loader2, Tag, BookOpen, ListChecks, Lightbulb, Sparkles } from 'lucide-react';

export default function LectureDetail() {
  const { lectureId } = useParams();
  const [lecture, setLecture] = useState(null);
  const [cls, setCls] = useState(null);
  const [note, setNote] = useState('');
  const [noteId, setNoteId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingNote, setSavingNote] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const lec = await base44.entities.Lecture.get(lectureId);
      setLecture(lec);
      if (lec.class_id) {
        const c = await base44.entities.Class.get(lec.class_id);
        setCls(c);
      }
      const notes = await base44.entities.Note.filter({ lecture_id: lectureId });
      if (notes.length > 0) {
        setNote(notes[0].content || '');
        setNoteId(notes[0].id);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [lectureId]);

  useEffect(() => { loadData(); }, [loadData]);

  const saveNote = async () => {
    setSavingNote(true);
    try {
      if (noteId) {
        await base44.entities.Note.update(noteId, { content: note });
      } else {
        const n = await base44.entities.Note.create({ lecture_id: lectureId, class_id: lecture?.class_id, content: note });
        setNoteId(n.id);
      }
    } catch (e) { console.error(e); }
    setSavingNote(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin"></div></div>;
  if (!lecture) return <div className="p-6 text-center text-muted-foreground">Lecture not found.</div>;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
      <Link to={cls ? `/classes/${cls.id}` : '/classes'} className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1">
        <ChevronLeft className="w-4 h-4" /> {cls?.name || 'Classes'}
      </Link>

      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <FileText className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="font-heading text-xl font-bold">{lecture.ai_title || `Lecture — ${lecture.date}`}</h1>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{lecture.date}</span>
            {lecture.duration_seconds > 0 && <span>• {Math.floor(lecture.duration_seconds / 60)} min</span>}
            {lecture.is_ai_estimated && <span className="flex items-center gap-1 text-amber-600"><AlertCircle className="w-3 h-3" /> AI Estimated</span>}
            {lecture.status === 'processing' && <span className="text-amber-600">• AI Processing...</span>}
          </div>
        </div>
      </div>

      {/* AI Estimated banner */}
      {lecture.is_ai_estimated && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 mb-6 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-500">This lecture was not recorded. The summary below is AI-generated based on previous lectures and course context. It may not reflect what was actually covered in class.</p>
        </div>
      )}

      {/* Audio player */}
      {lecture.recording_url && !lecture.is_missed && (
        <div className="rounded-xl border border-border bg-card p-4 mb-6">
          <audio controls className="w-full" src={lecture.recording_url}></audio>
        </div>
      )}

      {/* AI Summary */}
      {lecture.ai_summary && (
        <Section icon={Sparkles} title="AI Summary">
          <p className="text-sm text-foreground leading-relaxed">{lecture.ai_summary}</p>
        </Section>
      )}

      {/* Key Concepts */}
      {lecture.ai_concepts && lecture.ai_concepts.length > 0 && (
        <Section icon={Lightbulb} title="Key Concepts">
          <div className="flex flex-wrap gap-2">
            {lecture.ai_concepts.map((c, i) => (
              <span key={i} className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">{c}</span>
            ))}
          </div>
        </Section>
      )}

      {/* Vocabulary & Definitions */}
      {lecture.ai_definitions && lecture.ai_definitions.length > 0 && (
        <Section icon={BookOpen} title="Definitions">
          <div className="space-y-2">
            {lecture.ai_definitions.map((d, i) => (
              <div key={i} className="text-sm">
                <span className="font-medium text-foreground">{d.term}</span>
                <span className="text-muted-foreground"> — {d.definition}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Formulas */}
      {lecture.ai_formulas && lecture.ai_formulas.length > 0 && (
        <Section icon={Tag} title="Formulas">
          <div className="space-y-1.5">
            {lecture.ai_formulas.map((f, i) => (
              <div key={i} className="px-3 py-2 rounded-lg bg-muted font-mono text-sm">{f}</div>
            ))}
          </div>
        </Section>
      )}

      {/* Action Items */}
      {lecture.ai_action_items && lecture.ai_action_items.length > 0 && (
        <Section icon={ListChecks} title="Action Items">
          <ul className="space-y-1.5">
            {lecture.ai_action_items.map((a, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />{a}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Exam Mentions */}
      {lecture.ai_exam_mentions && lecture.ai_exam_mentions.length > 0 && (
        <Section icon={AlertCircle} title="Exam Announcements">
          <ul className="space-y-1.5">
            {lecture.ai_exam_mentions.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-500">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{m}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Transcript */}
      {lecture.transcript && (
        <Section icon={FileText} title="Transcript">
          <div className="max-h-64 overflow-y-auto pr-2">
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{lecture.transcript}</p>
          </div>
        </Section>
      )}

      {/* Notes */}
      <Section icon={FileText} title="My Notes">
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Add your own notes here..."
          className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
          rows={5}
        />
        <button onClick={saveNote} disabled={savingNote}
          className="mt-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
          {savingNote ? 'Saving...' : 'Save Notes'}
        </button>
      </Section>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-primary" strokeWidth={2} />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}