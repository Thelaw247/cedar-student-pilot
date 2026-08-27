import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, X, BookOpen, ChevronLeft, ChevronRight, List, Zap, Check, Brain, Expand, Filter } from 'lucide-react';
import QuizDepthSelector, { QUIZ_PRESETS } from '@/components/QuizDepthSelector';

export default function HandbookReader({ classId, lectureIds = null, assignmentId = null, studyMode = null, onClose, onQuizComplete = null }) {
  const [handbook, setHandbook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [showTOC, setShowTOC] = useState(false);
  const [showFullHandbook, setShowFullHandbook] = useState(false);
  const [quizDepth, setQuizDepth] = useState('standard');
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizResult, setQuizResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const params = { class_id: classId };
        if (lectureIds && lectureIds.length > 0) params.lecture_ids = lectureIds;
        if (assignmentId) params.assignment_id = assignmentId;
        if (showFullHandbook) {
          delete params.lecture_ids;
          delete params.assignment_id;
        }
        const res = await base44.functions.invoke('generateClassHandbook', params);
        if (res.data?.error) throw new Error(res.data.error);
        setHandbook(res.data);
        setCurrentChapter(0);
      } catch (e) {
        setError(e.message);
      }
      setLoading(false);
    };
    load();
    // lectureIds is an array — serialise it so a changed scope actually
    // retriggers the fetch. Leaving it out meant FocusMode could switch
    // scope while mounted and keep showing the previous scope's handbook.
  }, [classId, showFullHandbook, assignmentId, (lectureIds || []).join(',')]);

  const getQuestionCount = () => {
    const preset = QUIZ_PRESETS.find(p => p.key === quizDepth);
    if (preset) return preset.count;
    return parseInt(quizDepth) || 10;
  };

  const startQuiz = async () => {
    setShowQuiz(true);
    setQuizLoading(true);
    setQuizAnswers({});
    setQuizIdx(0);
    setQuizResult(null);
    try {
      // Quiz covers from chapter 0 up to and including current chapter
      const quizLectureIds = handbook.chapters
        .slice(0, currentChapter + 1)
        .map(ch => ch.lecture_id);

      const res = await base44.functions.invoke('generateLectureReview', {
        lecture_ids: quizLectureIds,
        quick_quiz: true,
        question_count: getQuestionCount(),
      });
      if (res.data?.error) throw new Error(res.data.error);
      setQuizQuestions(res.data?.review_questions || []);
      if (!res.data?.review_questions?.length) {
        setError('No quiz content available for these lectures.');
      }
    } catch (e) {
      setError(e.message);
    }
    setQuizLoading(false);
  };

  const finishQuiz = async () => {
    const score = quizQuestions.filter((q, i) => {
      const ans = quizAnswers[i];
      if (!ans) return false;
      return ans.trim().toLowerCase() === (q.correct_answer || '').trim().toLowerCase();
    }).length;
    const pct = Math.round((score / quizQuestions.length) * 100);

    // Write KnowledgeCoverage for each lecture covered
    const quizLectureIds = handbook.chapters.slice(0, currentChapter + 1).map(ch => ch.lecture_id);
    const today = new Date().toISOString().split('T')[0];
    const conceptsSeen = [...new Set(quizQuestions.map(q => q.concept).filter(Boolean))];
    const conceptsMastered = [...new Set(
      quizQuestions.map((q, i) => {
        const ans = quizAnswers[i];
        if (ans && ans.trim().toLowerCase() === (q.correct_answer || '').trim().toLowerCase()) return q.concept;
        return null;
      }).filter(Boolean)
    )];

    for (const lecId of quizLectureIds) {
      try {
        const existing = await base44.entities.KnowledgeCoverage.filter({ lecture_id: lecId });
        if (existing.length > 0) {
          const cov = existing[0];
          const mergedSeen = [...new Set([...(cov.concepts_seen || []), ...conceptsSeen])];
          const mergedMastered = [...new Set([...(cov.concepts_mastered || []), ...conceptsMastered])];
          await base44.entities.KnowledgeCoverage.update(cov.id, {
            last_reviewed_date: today,
            sessions_reviewed: (cov.sessions_reviewed || 0) + 1,
            concepts_seen: mergedSeen,
            concepts_mastered: mergedMastered,
            proficiency: mergedSeen.length > 0 ? Math.round((mergedMastered.length / mergedSeen.length) * 100) : 0,
          });
        } else {
          await base44.entities.KnowledgeCoverage.create({
            class_id: classId,
            lecture_id: lecId,
            last_reviewed_date: today,
            sessions_reviewed: 1,
            concepts_seen: conceptsSeen,
            concepts_mastered: conceptsMastered,
            proficiency: conceptsSeen.length > 0 ? Math.round((conceptsMastered.length / conceptsSeen.length) * 100) : 0,
          });
        }
      } catch (e) { console.error('Coverage write failed:', e); }
    }

    setQuizResult({ score, total: quizQuestions.length, pct, lecturesCovered: quizLectureIds.length });
    if (onQuizComplete) onQuizComplete({
      score,
      total: quizQuestions.length,
      pct,
      lecturesCovered: quizLectureIds.length,
      totalLectures: handbook.chapters.length,
    });
  };

  // Loading
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <h3 className="font-heading text-lg font-semibold mb-1">Building Your Handbook</h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Compiling lecture notes, summaries, and concepts into a study guide...
        </p>
      </div>
    );
  }

  if (error || !handbook || handbook.chapters?.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6">
        <BookOpen className="w-10 h-10 text-muted-foreground mb-4" strokeWidth={1.5} />
        <h3 className="font-heading text-lg font-semibold mb-1">No Handbook Available</h3>
        <p className="text-sm text-muted-foreground text-center mb-6 max-w-xs">
          {error || handbook?.message || 'Record and process lectures first to generate a handbook.'}
        </p>
        <button onClick={onClose} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
          Close
        </button>
      </div>
    );
  }

  const chapter = handbook.chapters[currentChapter];
  const isLastChapter = currentChapter === handbook.chapters.length - 1;

  // --- Quiz Mode ---
  if (showQuiz) {
    return (
      <QuizView
        questions={quizQuestions}
        loading={quizLoading}
        answers={quizAnswers}
        setAnswers={setQuizAnswers}
        idx={quizIdx}
        setIdx={setQuizIdx}
        result={quizResult}
        onFinish={finishQuiz}
        onClose={() => { setShowQuiz(false); setError(null); }}
        handbookTitle={handbook.title}
        chaptersCovered={currentChapter + 1}
        totalChapters={handbook.chapters.length}
      />
    );
  }

  // --- Handbook Reader ---
  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
          <button onClick={() => setShowTOC(!showTOC)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showTOC ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <List className="w-3.5 h-3.5" /> Contents
          </button>
        </div>

        {/* Book title block */}
        <div className="text-center mb-8 pb-6 border-b border-border">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Class Handbook</p>
          <h1 className="font-heading text-2xl font-bold mb-1" style={{ color: handbook.class_color }}>{handbook.title}</h1>
          {handbook.instructor && <p className="text-sm text-muted-foreground">by Prof. {handbook.instructor}</p>}
          {handbook.is_scoped && !showFullHandbook && (
            <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-600 text-[10px] font-medium">
              <Filter className="w-3 h-3" /> Scoped: {handbook.scope_label}
            </div>
          )}

          {/* Coverage. Lectures with no processed content are dropped from the
              handbook; without this the book just looks shorter than the class
              actually is, with no way to tell why. */}
          <p className="text-xs text-muted-foreground mt-3">
            {handbook.total_lectures} chapter{handbook.total_lectures === 1 ? '' : 's'}
            {handbook.lectures_excluded > 0 && (
              <span className="text-amber-600">
                {' · '}{handbook.lectures_excluded} lecture{handbook.lectures_excluded === 1 ? '' : 's'} not processed yet
              </span>
            )}
          </p>
        </div>

        {/* TOC dropdown */}
        {showTOC && (
          <div className="rounded-xl border border-border bg-card p-4 mb-6 animate-fade-in">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Table of Contents</p>
            <div className="space-y-1">
              {handbook.table_of_contents.map((toc, i) => (
                <button
                  key={i}
                  onClick={() => { setCurrentChapter(i); setShowTOC(false); }}
                  className={`w-full flex items-center gap-3 px-2 py-1.5 rounded-lg text-sm text-left transition-colors ${i === currentChapter ? 'bg-primary/5 text-primary font-medium' : 'text-foreground hover:bg-muted/50'}`}
                >
                  <span className="text-[10px] text-muted-foreground tabular-nums w-6">{String(toc.chapter).padStart(2, '0')}</span>
                  <span className="flex-1 truncate">{toc.title}</span>
                  {toc.section_count !== undefined && toc.section_count <= 2 && (
                    <span className="text-[9px] text-amber-600 font-medium uppercase tracking-wide">thin</span>
                  )}
                  <span className="text-[10px] text-muted-foreground">{toc.date}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Scoped handbook toggle */}
        {handbook.is_scoped && (
          <div className="flex justify-center mb-6">
            <button
              onClick={() => setShowFullHandbook(!showFullHandbook)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${showFullHandbook ? 'bg-primary/10 text-primary border-primary/30' : 'border-border text-muted-foreground hover:text-foreground'}`}
            >
              {showFullHandbook ? <><Filter className="w-3.5 h-3.5" /> Show Scoped Only</> : <><Expand className="w-3.5 h-3.5" /> Show Full Handbook</>}
            </button>
          </div>
        )}

        {/* Chapter content */}
        <div className="mb-6">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">
            Chapter {chapter.chapter_number} of {handbook.chapters.length}
          </p>
          <h2 className="font-heading text-xl font-bold mb-1">{chapter.title}</h2>
          <p className="text-xs text-muted-foreground mb-4">{chapter.lecture_date}</p>

          {/* The summary is generated as 2-3 paragraphs. Without
              whitespace-pre-wrap those breaks collapse and the main body of
              every chapter renders as one dense block. */}
          <div className="mb-5">
            {chapter.summary ? (
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{chapter.summary}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">No summary was captured for this lecture.</p>
            )}
          </div>

          {chapter.ai_expansion && (
            <div className="mb-5 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Brain className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] font-semibold text-primary uppercase tracking-widest">Added by AI to fill gaps</span>
              </div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{chapter.ai_expansion}</p>
              <p className="text-[10px] text-muted-foreground mt-2 italic">Supplementary context — not your professor's words. Double-check against the lecture.</p>
            </div>
          )}

          {/* Every section always renders, with an explicit empty state.
              Conditionally hiding them meant a chapter with no formulas looked
              identical to one where extraction failed, and the shape of a
              chapter changed unpredictably as you paged through the book. */}
          <ChapterSection title="Key Concepts" count={chapter.concepts?.length}>
            <div className="flex flex-wrap gap-2">
              {chapter.concepts.map((c, i) => (
                <span key={i} className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">{c}</span>
              ))}
            </div>
          </ChapterSection>

          <ChapterSection title="Definitions" count={chapter.definitions?.length}>
            <div className="space-y-2">
              {chapter.definitions.map((d, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium text-foreground">{d.term}</span>
                  <span className="text-muted-foreground"> — {d.definition}</span>
                </div>
              ))}
            </div>
          </ChapterSection>

          <ChapterSection title="Vocabulary" count={chapter.vocabulary?.length}>
            <div className="flex flex-wrap gap-2">
              {(chapter.vocabulary || []).map((v, i) => (
                <span key={i} className="px-2.5 py-1 rounded-md bg-muted text-foreground text-xs">{typeof v === 'string' ? v : v?.term}</span>
              ))}
            </div>
          </ChapterSection>

          <ChapterSection title="Formulas" count={chapter.formulas?.length}>
            <div className="space-y-1.5">
              {chapter.formulas.map((f, i) => (
                <div key={i} className="px-3 py-2 rounded-lg bg-muted font-mono text-sm">{f}</div>
              ))}
            </div>
          </ChapterSection>

          <ChapterSection title="Action Items" count={chapter.action_items?.length}>
            <ul className="space-y-1.5">
              {(chapter.action_items || []).map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                  {typeof a === 'string' ? a : a?.text}
                </li>
              ))}
            </ul>
          </ChapterSection>

          <ChapterSection title="Exam Announcements" count={chapter.exam_mentions?.length}>
            <ul className="space-y-1.5">
              {chapter.exam_mentions.map((m, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />{m}
                </li>
              ))}
            </ul>
          </ChapterSection>

          <ChapterSection title="Lecture Notes" count={chapter.notes ? 1 : 0}>
            <div className="rounded-lg bg-muted/50 p-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap">{chapter.notes}</div>
          </ChapterSection>

          {chapter.transcript_excerpt && (
            <details className="mb-4 group">
              <summary className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 cursor-pointer hover:text-foreground select-none">
                From the Transcript
                {chapter.transcript_length > chapter.transcript_excerpt.length && (
                  <span className="ml-1.5 font-normal normal-case tracking-normal">
                    (first {Math.round(chapter.transcript_excerpt.length / 100) / 10}k of {Math.round(chapter.transcript_length / 100) / 10}k characters)
                  </span>
                )}
              </summary>
              <div className="rounded-lg bg-muted/30 p-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto">
                {chapter.transcript_excerpt}
              </div>
            </details>
          )}
        </div>

        {/* Quiz depth selector + quiz button */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-primary" />
            <p className="text-sm font-medium text-foreground">Test Your Knowledge</p>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Quiz covers chapters 1–{currentChapter + 1} ({currentChapter + 1} lecture{currentChapter !== 0 ? 's' : ''} reviewed so far).
          </p>
          <QuizDepthSelector value={quizDepth} onChange={setQuizDepth} />
          <button
            onClick={startQuiz}
            className="w-full mt-3 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-2"
          >
            <Brain className="w-4 h-4" /> Start Quiz (Ch 1–{currentChapter + 1})
          </button>
        </div>

        {/* Chapter navigation */}
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={() => setCurrentChapter(Math.max(0, currentChapter - 1))}
            disabled={currentChapter === 0}
            className="inline-flex items-center gap-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <p className="text-xs text-muted-foreground tabular-nums">{currentChapter + 1} / {handbook.chapters.length}</p>
          <button
            onClick={() => setCurrentChapter(Math.min(handbook.chapters.length - 1, currentChapter + 1))}
            disabled={isLastChapter}
            className="inline-flex items-center gap-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Always renders its heading. When `count` is 0 the body is replaced by an
 * explicit "nothing captured" line rather than the whole section vanishing,
 * so a student can tell the difference between a lecture that had no formulas
 * and one where extraction failed.
 */
function ChapterSection({ title, count, children }) {
  const isEmpty = !count;
  return (
    <div className="mb-4">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{title}</h3>
      {isEmpty
        ? <p className="text-sm text-muted-foreground/70 italic">Nothing captured for this lecture.</p>
        : children}
    </div>
  );
}

function QuizView({ questions, loading, answers, setAnswers, idx, setIdx, result, onFinish, onClose, handbookTitle, chaptersCovered, totalChapters }) {
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <h3 className="font-heading text-lg font-semibold mb-1">Generating Quiz</h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Creating {chaptersCovered > 1 ? `${chaptersCovered} chapters'` : "this chapter's"} worth of questions...
        </p>
      </div>
    );
  }

  if (result) {
    return (
      <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
        <div className="max-w-md mx-auto px-4 py-8">
          <div className="text-center mb-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Check className="w-10 h-10 text-primary" strokeWidth={2} />
            </div>
            <h3 className="font-heading text-xl font-bold mb-1">Quiz Complete</h3>
            <p className="text-sm text-muted-foreground">{handbookTitle}</p>
            <p className="font-heading text-3xl font-bold text-primary mt-2">{result.pct}%</p>
            <p className="text-sm text-muted-foreground mt-1">{result.score}/{result.total} correct • {result.lecturesCovered} lecture{result.lecturesCovered !== 1 ? 's' : ''} covered</p>
          </div>

          {/* Per-concept breakdown */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 mb-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Question Breakdown</p>
            <div className="space-y-2">
              {questions.map((q, i) => {
                const correct = answers[i]?.trim().toLowerCase() === (q.correct_answer || '').trim().toLowerCase();
                return (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${correct ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                      {correct ? <Check className="w-3 h-3 text-emerald-600" strokeWidth={3} /> : <X className="w-3 h-3 text-rose-600" strokeWidth={3} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground">{q.question}</p>
                      {!correct && <p className="text-xs text-emerald-600 mt-0.5">Correct: {q.correct_answer}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <button onClick={onClose} className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            Back to Handbook
          </button>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6">
        <Brain className="w-10 h-10 text-muted-foreground mb-4" strokeWidth={1.5} />
        <h3 className="font-heading text-lg font-semibold mb-1">No Quiz Available</h3>
        <p className="text-sm text-muted-foreground text-center mb-6 max-w-xs">Not enough content to generate a quiz for these chapters.</p>
        <button onClick={onClose} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">Back</button>
      </div>
    );
  }

  const q = questions[idx];
  const isLast = idx === questions.length - 1;
  const hasAnswer = answers[idx]?.trim();

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
          <span className="text-xs font-medium text-muted-foreground">Question {idx + 1} of {questions.length}</span>
          <div className="w-5" />
        </div>

        <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-8">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${((idx + 1) / questions.length) * 100}%` }} />
        </div>

        {q.flow_position && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase mb-3 inline-block bg-blue-500/10 text-blue-600">
            {q.flow_position} of lecture
          </span>
        )}

        <h3 className="font-heading text-lg font-semibold mb-6">{q.question}</h3>

        {q.type === 'multiple_choice' && q.options?.length > 0 ? (
          <div className="space-y-2 mb-6">
            {q.options.map((opt, i) => (
              <button
                key={i}
                onClick={() => setAnswers({ ...answers, [idx]: opt })}
                className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${answers[idx] === opt ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border hover:border-primary/30'}`}
              >
                {opt}
              </button>
            ))}
          </div>
        ) : (
          <input
            type="text"
            value={answers[idx] || ''}
            onChange={e => setAnswers({ ...answers, [idx]: e.target.value })}
            placeholder="Type your answer..."
            className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 mb-6"
            autoFocus
          />
        )}

        <div className="flex gap-2">
          {idx > 0 && (
            <button onClick={() => setIdx(idx - 1)} className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted">Back</button>
          )}
          {isLast ? (
            <button onClick={onFinish} disabled={!hasAnswer} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5">
              <Check className="w-4 h-4" /> Finish Quiz
            </button>
          ) : (
            <button onClick={() => setIdx(idx + 1)} disabled={!hasAnswer} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5">
              Next <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
