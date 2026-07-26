import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { ChevronLeft, Loader2, Check, X, ListChecks, ArrowRight, RotateCcw } from 'lucide-react';

export default function LectureReview() {
  const params = useParams();
  const scope = params.scope || 'today';
  const lectureId = params.lectureId;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showResult, setShowResult] = useState(false);
  const [grades, setGrades] = useState({});
  const [grading, setGrading] = useState(false);

  const isFreeText = (q) => q.type === 'short_answer' || q.type === 'one_word';
  const choiceCorrect = (q, ans) => !!ans && ans.trim().toLowerCase() === (q.correct_answer || '').trim().toLowerCase();
  const isCorrect = (q, i) => isFreeText(q) ? grades[i]?.correct === true : choiceCorrect(q, answers[i]);

  const finishReview = async (qs) => {
    const freeTextItems = [];
    qs.forEach((q, i) => {
      if (isFreeText(q)) freeTextItems.push({ index: i, question: q.question, correct_answer: q.correct_answer, student_answer: answers[i] || '' });
    });
    if (freeTextItems.length > 0) {
      setGrading(true);
      try {
        const res = await base44.functions.invoke('generateLectureReview', {
          grade_answers: freeTextItems.map(({ question, correct_answer, student_answer }) => ({ question, correct_answer, student_answer })),
        });
        const out = res.data?.results || [];
        const mapped = {};
        freeTextItems.forEach((item, k) => { if (out[k]) mapped[item.index] = out[k]; });
        setGrades(mapped);
      } catch (e) {
        const mapped = {};
        freeTextItems.forEach((item) => { mapped[item.index] = { correct: false, feedback: 'Could not auto-grade — compare your answer with the model answer below.' }; });
        setGrades(mapped);
      }
      setGrading(false);
    }
    setShowResult(true);
  };

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        let payload = {};
        if (lectureId) {
          payload = { lecture_ids: [lectureId] };
        } else {
          payload = { scope };
        }
        const res = await base44.functions.invoke('generateLectureReview', payload);
        setData(res.data);
      } catch (e) {
        setData({ error: 'Failed to generate review.' });
      }
      setLoading(false);
    };
    run();
  }, [scope, lectureId]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center">
        <Loader2 className="w-8 h-8 text-primary mx-auto animate-spin mb-4" />
        <p className="text-sm text-muted-foreground">Generating review questions following your professor's teaching flow...</p>
      </div>
    );
  }

  if (data?.error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center">
        <p className="text-sm text-destructive">{data.error}</p>
        <Link to="/study-tools" className="text-sm text-primary font-medium mt-2 inline-block hover:underline">Back to Practice</Link>
      </div>
    );
  }

  if (!data?.review_questions?.length) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center">
        <ListChecks className="w-10 h-10 text-muted-foreground mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm text-muted-foreground">{data?.message || 'No lecture content available for review yet.'}</p>
        <Link to="/study-tools" className="text-sm text-primary font-medium mt-2 inline-block hover:underline">Back to Practice</Link>
      </div>
    );
  }

  const questions = data.review_questions;
  const teachingFlow = data.teaching_flow || [];
  const current = questions[currentIdx];
  const isLast = currentIdx === questions.length - 1;

  const score = questions.filter((q, i) => isCorrect(q, i)).length;

  // Results screen
  if (showResult) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Check className="w-10 h-10 text-primary" strokeWidth={2} />
          </div>
          <h1 className="font-heading text-2xl font-bold mb-1">Review Complete</h1>
          <p className="text-muted-foreground text-sm">You answered {score} out of {questions.length} correctly</p>
          <p className="text-2xl font-bold text-primary mt-2">{Math.round((score / questions.length) * 100)}%</p>
        </div>

        {/* Teaching flow recap */}
        {teachingFlow.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4 mb-6">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-primary" /> Teaching Flow Covered
            </h3>
            <div className="space-y-2">
              {teachingFlow.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                  <span className="text-foreground">{item.topic}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Question review */}
        <div className="space-y-3 mb-6">
          {questions.map((q, i) => {
            const ans = answers[i];
            const correct = isCorrect(q, i);
            const freeText = isFreeText(q);
            return (
              <div key={i} className={`rounded-xl border p-4 ${correct ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5'}`}>
                <div className="flex items-start gap-2">
                  {correct ? <Check className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" /> : <X className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground mb-1">{q.question}</p>
                    <p className="text-xs text-muted-foreground">Your answer: <span className={correct ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>{ans || '—'}</span></p>
                    {(!correct || freeText) && q.correct_answer && (
                      <p className="text-xs text-emerald-600 mt-0.5">{freeText ? 'Model answer' : 'Correct'}: {q.correct_answer}</p>
                    )}
                    {freeText && grades[i]?.feedback && (
                      <p className="text-xs text-foreground/70 mt-1 italic">{grades[i].feedback}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button onClick={() => { setAnswers({}); setShowResult(false); setCurrentIdx(0); }}
            className="flex-1 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted flex items-center justify-center gap-2">
            <RotateCcw className="w-4 h-4" /> Retry
          </button>
          <Link to="/study-tools" className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-2">
            Done
          </Link>
        </div>
      </div>
    );
  }

  // Question screen
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
      <Link to="/study-tools" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1">
        <ChevronLeft className="w-4 h-4" /> Back
      </Link>

      {/* Progress + teaching flow indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium text-muted-foreground">
            Question {currentIdx + 1} of {questions.length}
          </p>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md uppercase ${
            current.flow_position === 'start' ? 'bg-blue-500/10 text-blue-600' :
            current.flow_position === 'end' ? 'bg-purple-500/10 text-purple-600' :
            'bg-amber-500/10 text-amber-600'
          }`}>
            {current.flow_position} of lecture {current.lecture_index}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all duration-standard" style={{ width: `${((currentIdx) / questions.length) * 100}%` }} />
        </div>
      </div>

      {/* Question */}
      <div className="rounded-xl border border-border bg-card p-5 mb-4">
        <p className="text-sm font-medium text-foreground mb-4">{current.question}</p>

        {current.type === 'multiple_choice' && current.options?.length > 0 ? (
          <div className="space-y-2">
            {current.options.map((opt, i) => {
              const selected = answers[currentIdx] === opt;
              return (
                <button
                  key={i}
                  onClick={() => setAnswers({ ...answers, [currentIdx]: opt })}
                  className={`w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-all ${
                    selected ? 'border-primary bg-primary/5 text-primary font-medium' : 'border-border hover:border-primary/30'
                  }`}>
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
            className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            autoFocus
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        {currentIdx > 0 && (
          <button onClick={() => setCurrentIdx(currentIdx - 1)} className="px-4 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted">
            Back
          </button>
        )}
        {isLast ? (
          <button
            onClick={() => setShowResult(true)}
            disabled={!answers[currentIdx]}
            className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
            <Check className="w-4 h-4" /> Finish Review
          </button>
        ) : (
          <button
            onClick={() => setCurrentIdx(currentIdx + 1)}
            disabled={!answers[currentIdx]}
            className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
            Next <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}