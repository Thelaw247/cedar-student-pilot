import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { X, Loader2, Check, Clock, Brain, ArrowRight, RotateCcw } from 'lucide-react';

const QUIZ_DURATION = 300; // 5 minutes in seconds

export default function InLectureQuiz({ lecture, cls, onClose }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(QUIZ_DURATION);
  const [showResult, setShowResult] = useState(false);
  const [coverageWritten, setCoverageWritten] = useState(false);
  const [error, setError] = useState(null);
  const [grades, setGrades] = useState({});   // index -> { correct, feedback } for short answers
  const [grading, setGrading] = useState(false);

  // A question needs AI concept-grading only when it's free-text (short answer
  // or one-word); multiple choice and true/false are exact-match locally.
  const isFreeText = (q) => q.type === 'short_answer' || q.type === 'one_word';

  // Objective correctness for choice-type questions (exact match).
  const choiceCorrect = (q, ans) =>
    !!ans && ans.trim().toLowerCase() === (q.correct_answer || '').trim().toLowerCase();

  // Unified correctness: AI grade for free-text, exact match otherwise.
  const isCorrect = (q, i) => {
    if (isFreeText(q)) return grades[i]?.correct === true;
    return choiceCorrect(q, answers[i]);
  };

  // Run concept-based grading for the free-text answers, then show results.
  const finishQuiz = async () => {
    const freeTextItems = [];
    questions.forEach((q, i) => {
      if (isFreeText(q)) {
        freeTextItems.push({
          index: i,
          question: q.question,
          correct_answer: q.correct_answer,
          student_answer: answers[i] || '',
        });
      }
    });

    if (freeTextItems.length > 0) {
      setGrading(true);
      try {
        const res = await base44.functions.invoke('generateLectureReview', {
          grade_answers: freeTextItems.map(({ question, correct_answer, student_answer }) => ({ question, correct_answer, student_answer })),
        });
        const out = res.data?.results || [];
        const mapped = {};
        freeTextItems.forEach((item, k) => {
          if (out[k]) mapped[item.index] = out[k];
        });
        setGrades(mapped);
      } catch (e) {
        // If grading fails, fall back to marking free-text as needs-review
        // rather than silently wrong.
        const mapped = {};
        freeTextItems.forEach((item) => { mapped[item.index] = { correct: false, feedback: 'Could not auto-grade — compare your answer with the model answer below.' }; });
        setGrades(mapped);
      }
      setGrading(false);
    }
    setShowResult(true);
  };

  // Generate quiz on mount
  useEffect(() => {
    const run = async () => {
      try {
        const res = await base44.functions.invoke('generateLectureReview', {
          lecture_ids: [lecture.id],
          quick_quiz: true,
        });
        if (res.data?.error) throw new Error(res.data.error);
        setQuestions(res.data?.review_questions || []);
        if (!res.data?.review_questions?.length) {
          setError(res.data?.message || 'No quiz content available for this lecture.');
        }
      } catch (e) {
        setError(e.message || 'Failed to generate quiz.');
      }
      setLoading(false);
    };
    run();
  }, [lecture.id]);

  // Countdown timer
  useEffect(() => {
    if (loading || showResult || error || questions.length === 0) return;
    if (timeLeft <= 0) {
      setShowResult(true);
      return;
    }
    const timer = setTimeout(() => setTimeLeft(t => t - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, loading, showResult, error, questions.length]);

  // Write KnowledgeCoverage when quiz completes
  useEffect(() => {
    if (!showResult || coverageWritten) return;
    const writeCoverage = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const existing = await base44.entities.KnowledgeCoverage.filter({ lecture_id: lecture.id });

        // Compute concept-level mastery from quiz results
        const conceptResults = {};
        questions.forEach((q, i) => {
          const concept = q.concept || 'General';
          if (!conceptResults[concept]) conceptResults[concept] = { correct: 0, total: 0 };
          conceptResults[concept].total++;
          const ans = answers[i];
          if (ans && ans.trim().toLowerCase() === (q.correct_answer || '').trim().toLowerCase()) {
            conceptResults[concept].correct++;
          }
        });

        const newConceptsSeen = Object.keys(conceptResults);
        const newConceptsMastered = Object.entries(conceptResults)
          .filter(([, r]) => r.correct === r.total)
          .map(([c]) => c);

        if (existing.length > 0) {
          const cov = existing[0];
          const mergedSeen = [...new Set([...(cov.concepts_seen || []), ...newConceptsSeen])];
          const mergedMastered = [...new Set([...(cov.concepts_mastered || []), ...newConceptsMastered])];
          await base44.entities.KnowledgeCoverage.update(cov.id, {
            last_reviewed_date: today,
            sessions_reviewed: (cov.sessions_reviewed || 0) + 1,
            concepts_seen: mergedSeen,
            concepts_mastered: mergedMastered,
            proficiency: mergedSeen.length > 0
              ? Math.round((mergedMastered.length / mergedSeen.length) * 100)
              : 0,
          });
        } else {
          await base44.entities.KnowledgeCoverage.create({
            class_id: lecture.class_id,
            lecture_id: lecture.id,
            last_reviewed_date: today,
            sessions_reviewed: 1,
            concepts_seen: newConceptsSeen,
            concepts_mastered: newConceptsMastered,
            proficiency: newConceptsSeen.length > 0
              ? Math.round((newConceptsMastered.length / newConceptsSeen.length) * 100)
              : 0,
          });
        }
        setCoverageWritten(true);
      } catch (e) {
        console.error('Failed to write coverage:', e);
      }
    };
    writeCoverage();
  }, [showResult, coverageWritten, questions, answers, lecture]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 glass flex items-center justify-center px-4">
        <div className="bg-card rounded-2xl border border-border p-8 max-w-sm w-full text-center animate-fade-in">
          <Loader2 className="w-10 h-10 text-primary mx-auto animate-spin mb-4" />
          <h3 className="font-heading text-lg font-semibold mb-1">Generating Focus Quiz</h3>
          <p className="text-sm text-muted-foreground">AI is selecting the hardest concepts from this lecture...</p>
        </div>
      </div>
    );
  }

  // Error / empty state
  if (error || questions.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 glass flex items-center justify-center px-4">
        <div className="bg-card rounded-2xl border border-border p-8 max-w-sm w-full text-center animate-fade-in">
          <Brain className="w-10 h-10 text-muted-foreground mx-auto mb-4" strokeWidth={1.5} />
          <h3 className="font-heading text-lg font-semibold mb-1">No Quiz Available</h3>
          <p className="text-sm text-muted-foreground mb-6">{error || 'This lecture has no content to quiz on yet.'}</p>
          <button onClick={onClose} className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            Back to Lecture
          </button>
        </div>
      </div>
    );
  }

  const current = questions[currentIdx];
  const isLast = currentIdx === questions.length - 1;
  const score = questions.filter((q, i) => {
    const ans = answers[i];
    if (!ans) return false;
    return ans.trim().toLowerCase() === (q.correct_answer || '').trim().toLowerCase();
  }).length;

  // Per-concept breakdown
  const conceptBreakdown = {};
  questions.forEach((q, i) => {
    const concept = q.concept || 'General';
    if (!conceptBreakdown[concept]) conceptBreakdown[concept] = { correct: 0, total: 0 };
    conceptBreakdown[concept].total++;
    const ans = answers[i];
    if (ans && ans.trim().toLowerCase() === (q.correct_answer || '').trim().toLowerCase()) {
      conceptBreakdown[concept].correct++;
    }
  });

  // Results screen
  if (showResult) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="fixed inset-0 z-50 bg-black/50 glass flex items-center justify-center px-4 overflow-y-auto py-8">
        <div className="bg-card rounded-2xl border border-border p-6 sm:p-8 max-w-md w-full animate-fade-in">
          <div className="text-center mb-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Check className="w-10 h-10 text-primary" strokeWidth={2} />
            </div>
            <h3 className="font-heading text-xl font-bold mb-1">Quiz Complete</h3>
            <p className="text-sm text-muted-foreground">
              {timeLeft <= 0 ? "Time's up! " : ''}You scored {score}/{questions.length}
            </p>
            <p className="font-heading text-3xl font-bold text-primary mt-2">{pct}%</p>
          </div>

          {/* Per-concept breakdown */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 mb-6">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Concept Breakdown</p>
            <div className="space-y-2">
              {Object.entries(conceptBreakdown).map(([concept, r]) => {
                const passed = r.correct === r.total;
                return (
                  <div key={concept} className="flex items-center justify-between text-sm">
                    <span className="text-foreground truncate flex-1">{concept}</span>
                    <span className={`text-xs font-medium ${passed ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {r.correct}/{r.total} {passed ? '✓' : '✗'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted">
              Done — Back to Lecture
            </button>
            <button
              onClick={() => navigate(`/lecture-review/lecture/${lecture.id}`)}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-1.5"
            >
              <Brain className="w-4 h-4" /> Review Missed
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Question screen
  return (
    <div className="fixed inset-0 z-50 bg-black/50 glass flex items-center justify-center px-4 overflow-y-auto py-8">
      <div className="bg-card rounded-2xl border border-border p-6 sm:p-8 max-w-md w-full animate-fade-in">
        {/* Header with timer */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
          <p className="text-xs font-medium text-muted-foreground">
            Question {currentIdx + 1} of {questions.length}
          </p>
          <div className={`inline-flex items-center gap-1 text-sm font-bold tabular-nums ${timeLeft < 60 ? 'text-destructive' : 'text-muted-foreground'}`}>
            <Clock className="w-4 h-4" />
            {formatTime(timeLeft)}
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-6">
          <div
            className="h-full bg-primary rounded-full transition-all duration-standard"
            style={{ width: `${(currentIdx / questions.length) * 100}%` }}
          />
        </div>

        {/* Flow position indicator */}
        {current.flow_position && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase mb-3 inline-block bg-blue-500/10 text-blue-600">
            {current.flow_position} of lecture
          </span>
        )}

        {/* Question */}
        <h3 className="font-heading text-lg font-semibold mb-6">{current.question}</h3>

        {/* Answer input */}
        {current.type === 'multiple_choice' && current.options?.length > 0 ? (
          <div className="space-y-2 mb-6">
            {current.options.map((opt, i) => {
              const selected = answers[currentIdx] === opt;
              return (
                <button
                  key={i}
                  onClick={() => setAnswers({ ...answers, [currentIdx]: opt })}
                  className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                    selected
                      ? 'border-primary bg-primary/5 text-primary font-medium'
                      : 'border-border hover:border-primary/30'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        ) : (
          <input
            type="text"
            value={answers[currentIdx] || ''}
            onChange={e => setAnswers({ ...answers, [currentIdx]: e.target.value })}
            placeholder="Type your answer..."
            className="w-full px-4 py-3 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 mb-6"
            autoFocus
          />
        )}

        {/* Navigation */}
        <div className="flex gap-2">
          {currentIdx > 0 && (
            <button onClick={() => setCurrentIdx(currentIdx - 1)} className="px-4 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted">
              Back
            </button>
          )}
          {isLast ? (
            <button
              onClick={() => setShowResult(true)}
              disabled={!answers[currentIdx]}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" /> Finish Quiz
            </button>
          ) : (
            <button
              onClick={() => setCurrentIdx(currentIdx + 1)}
              disabled={!answers[currentIdx]}
              className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}