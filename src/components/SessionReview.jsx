import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, X, Brain, Check, ChevronRight, Award, TrendingUp, BookOpen, Target } from 'lucide-react';

export default function SessionReview({ classId, className, lectureId, studyRecordId, aiInteractions, onClose }) {
  const [phase, setPhase] = useState('loading'); // loading -> questions -> self_assessment -> results
  const [questions, setQuestions] = useState([]);
  const [lectureIds, setLectureIds] = useState([]);
  const [selfAssessmentTopics, setSelfAssessmentTopics] = useState([]);
  const [answers, setAnswers] = useState({});
  const [selfRatings, setSelfRatings] = useState({});
  const [selfCovered, setSelfCovered] = useState({});
  const [results, setResults] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);

  useEffect(() => {
    generateReview();
  }, []);

  const generateReview = async () => {
    setPhase('loading');
    try {
      const params = { class_id: classId };
      if (lectureId) params.lecture_ids = [lectureId];
      const res = await base44.functions.invoke('generateSessionReview', params);
      if (!res.data || res.data.error) throw new Error(res.data?.error || 'Failed to generate');
      setQuestions(res.data.review_questions || []);
      setLectureIds(res.data.lecture_ids || (lectureId ? [lectureId] : []));
      setSelfAssessmentTopics(res.data.self_assessment_topics || []);
      setPhase(res.data.review_questions?.length > 0 ? 'questions' : 'empty');
    } catch (e) {
      setPhase('error');
    }
  };

  const handleAnswer = (questionIdx, answer) => {
    setAnswers(prev => ({ ...prev, [questionIdx]: answer }));
  };

  const submitQuestions = () => {
    setPhase('self_assessment');
  };

  const submitReview = async () => {
    setGenerating(true);
    try {
      // Evaluate answers using AI
      const evaluatedQuestions = await Promise.all(questions.map(async (q, idx) => {
        const userAnswer = answers[idx] || '';
        if (!userAnswer) return { ...q, user_answer: '', is_correct: false };

        if (q.type === 'multiple_choice') {
          return { ...q, user_answer: userAnswer, is_correct: userAnswer === q.correct_answer };
        }

        // Use LLM to evaluate short answer and one word
        const evalRes = await base44.integrations.Core.InvokeLLM({
          prompt: `You are grading a student's answer. Determine if it is correct.

Question: ${q.question}
Correct Answer: ${q.correct_answer}
Student Answer: ${userAnswer}

Be lenient with wording but strict on correctness. For one-word answers, the student's answer must match the concept (synonyms ok, wrong concepts are not).

Return JSON: { "is_correct": boolean, "reasoning": string }`,
          response_json_schema: {
            type: 'object',
            properties: {
              is_correct: { type: 'boolean' },
              reasoning: { type: 'string' }
            }
          }
        });

        return { ...q, user_answer: userAnswer, is_correct: evalRes.is_correct };
      }));

      const selfAssessment = selfAssessmentTopics.map((topic, idx) => ({
        topic: topic.topic,
        concept: topic.concept,
        covered: selfCovered[idx] !== false,
        proficiency: selfRatings[idx] || 0
      }));

      const res = await base44.functions.invoke('processSessionReview', {
        class_id: classId,
        lecture_ids: lectureIds,
        review_questions: evaluatedQuestions,
        self_assessment: selfAssessment,
        ai_interactions: aiInteractions || [],
        study_record_id: studyRecordId
      });

      if (res.data && !res.data.error) {
        setResults({
          ...res.data,
          evaluatedQuestions,
          selfAssessment
        });
        setPhase('results');
      } else {
        throw new Error(res.data?.error || 'Failed to process review');
      }
    } catch (e) {
      alert('Failed to process review: ' + e.message);
    }
    setGenerating(false);
  };

  // --- Loading ---
  if (phase === 'loading') {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <h3 className="font-heading text-lg font-semibold mb-1">Generating Your Review</h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          AI is creating personalized questions from your lecture content...
        </p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6">
        <X className="w-10 h-10 text-destructive mb-4" />
        <h3 className="font-heading text-lg font-semibold mb-1">Couldn't Generate Review</h3>
        <p className="text-sm text-muted-foreground text-center mb-6 max-w-xs">
          Make sure you have lectures with AI content processed for this class.
        </p>
        <button onClick={onClose} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
          Close
        </button>
      </div>
    );
  }

  if (phase === 'empty') {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6">
        <BookOpen className="w-10 h-10 text-muted-foreground mb-4" />
        <h3 className="font-heading text-lg font-semibold mb-1">No Content Yet</h3>
        <p className="text-sm text-muted-foreground text-center mb-6 max-w-xs">
          Record a lecture and let AI process it first, then you can do a review session.
        </p>
        <button onClick={onClose} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
          Close
        </button>
      </div>
    );
  }

  // --- Results ---
  if (phase === 'results' && results) {
    const correctCount = results.evaluatedQuestions.filter(q => q.is_correct).length;
    const totalCount = results.evaluatedQuestions.length;
    const scoreColor = results.overall_score >= 75 ? 'text-emerald-600' : results.overall_score >= 50 ? 'text-amber-600' : 'text-rose-600';

    return (
      <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
          <div className="text-center mb-8 animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Award className="w-8 h-8 text-primary" />
            </div>
            <h2 className="font-heading text-2xl font-bold mb-1">Session Review Complete</h2>
            <p className="text-sm text-muted-foreground">{className}</p>
          </div>

          {/* Main score */}
          <div className="rounded-2xl border border-border bg-card p-6 mb-4 text-center">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Overall Score</p>
            <p className={`font-heading text-5xl font-bold ${scoreColor}`}>{results.overall_score}<span className="text-2xl">%</span></p>
            <p className="text-sm text-muted-foreground mt-2">
              {correctCount}/{totalCount} questions correct
            </p>
          </div>

          {/* Score breakdown */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <ScoreCard icon={Target} label="Proficiency" value={results.proficiency_score} color="text-primary" />
            <ScoreCard icon={BookOpen} label="Coverage" value={results.coverage_percentage} color="text-emerald-600" />
            <ScoreCard icon={TrendingUp} label="In-Depth" value={results.in_depth_score} color="text-amber-600" />
          </div>

          {/* Coverage progress */}
          <div className="rounded-xl border border-border bg-card p-5 mb-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Course Knowledge Covered</h3>
              <span className="text-sm font-bold text-primary">{results.concepts_covered}/{results.total_concepts} concepts</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-1000"
                style={{ width: `${results.coverage_percentage}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {results.coverage_percentage}% of all course concepts covered across your sessions
            </p>
          </div>

          {/* AI Interactions summary */}
          {aiInteractions && aiInteractions.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">AI Interactions During Session</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">{aiInteractions.length} questions asked during study</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {aiInteractions.map((ai, idx) => (
                  <div key={idx} className="text-xs">
                    <p className="font-medium text-foreground">Q: {ai.question}</p>
                    <p className="text-muted-foreground ml-3">A: {ai.answer?.substring(0, 150)}{ai.answer?.length > 150 ? '...' : ''}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Question breakdown */}
          <div className="rounded-xl border border-border bg-card p-5 mb-6">
            <h3 className="text-sm font-semibold mb-3">Question Breakdown</h3>
            <div className="space-y-3">
              {results.evaluatedQuestions.map((q, idx) => (
                <div key={idx} className="rounded-lg border border-border p-3">
                  <div className="flex items-start gap-2">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${q.is_correct ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                      {q.is_correct
                        ? <Check className="w-3 h-3 text-emerald-600" strokeWidth={3} />
                        : <X className="w-3 h-3 text-rose-600" strokeWidth={3} />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{q.question}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Your answer: <span className={q.is_correct ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>{q.user_answer || '(no answer)'}</span>
                      </p>
                      {!q.is_correct && (
                        <p className="text-xs text-emerald-600 mt-0.5">Correct: {q.correct_answer}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Self assessment summary */}
          {results.selfAssessment && results.selfAssessment.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5 mb-6">
              <h3 className="text-sm font-semibold mb-3">Self-Assessment</h3>
              <div className="space-y-2">
                {results.selfAssessment.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <span className="text-xs text-foreground">{s.topic}</span>
                    <div className="flex items-center gap-2">
                      {s.covered ? (
                        <span className="text-xs text-emerald-600">Covered</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not covered</span>
                      )}
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${s.proficiency}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={onClose}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
            Done — View Analytics
          </button>
        </div>
      </div>
    );
  }

  // --- Questions Phase ---
  if (phase === 'questions') {
    const q = questions[currentQuestion];
    const isLast = currentQuestion === questions.length - 1;
    const hasAnswer = answers[currentQuestion] && answers[currentQuestion].trim();

    return (
      <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
          {/* Progress */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
            <span className="text-xs font-medium text-muted-foreground">
              Question {currentQuestion + 1} of {questions.length}
            </span>
            <div className="w-5" />
          </div>

          <div className="h-1 bg-muted rounded-full mb-8 overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }} />
          </div>

          {/* Question type badge */}
          <span className={`text-[10px] font-semibold px-2 py-1 rounded-md uppercase mb-3 inline-block ${
            q.type === 'multiple_choice' ? 'bg-blue-500/10 text-blue-600' :
            q.type === 'problem' ? 'bg-rose-500/10 text-rose-600' :
            q.type === 'short_answer' ? 'bg-purple-500/10 text-purple-600' :
            'bg-amber-500/10 text-amber-600'
          }`}>
            {q.type === 'multiple_choice' ? 'Multiple Choice' :
             q.type === 'problem' ? 'Problem' :
             q.type === 'short_answer' ? 'Short Answer' : 'One Word'}
          </span>

          <h3 className="font-heading text-lg sm:text-xl font-semibold mb-6">{q.question}</h3>

          {/* Answer input */}
          {q.type === 'multiple_choice' && (
            <div className="space-y-2">
              {q.options.map((opt, i) => (
                <button key={i} onClick={() => handleAnswer(currentQuestion, opt)}
                  className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                    answers[currentQuestion] === opt
                      ? 'border-primary bg-primary/5 text-primary font-medium'
                      : 'border-border bg-card text-foreground hover:border-primary/30'
                  }`}>
                  <span className="text-sm">{opt}</span>
                </button>
              ))}
            </div>
          )}

          {q.type === 'problem' && (
            <textarea
              value={answers[currentQuestion] || ''}
              onChange={e => handleAnswer(currentQuestion, e.target.value)}
              placeholder="Show your work and enter your final answer..."
              className="w-full px-4 py-3 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none font-mono"
              rows={6}
              autoFocus
            />
          )}

          {q.type === 'short_answer' && (
            <textarea
              value={answers[currentQuestion] || ''}
              onChange={e => handleAnswer(currentQuestion, e.target.value)}
              placeholder="Type your answer (1-2 sentences)..."
              className="w-full px-4 py-3 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              rows={3}
              autoFocus
            />
          )}

          {q.type === 'one_word' && (
            <input
              type="text"
              value={answers[currentQuestion] || ''}
              onChange={e => handleAnswer(currentQuestion, e.target.value)}
              placeholder="One word..."
              className="w-full px-4 py-3 rounded-xl border border-input bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              autoFocus
            />
          )}

          {/* Navigation */}
          <div className="flex items-center gap-2 mt-8">
            {currentQuestion > 0 && (
              <button onClick={() => setCurrentQuestion(c => c - 1)}
                className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted">
                Back
              </button>
            )}
            <button onClick={() => isLast ? submitQuestions() : setCurrentQuestion(c => c + 1)}
              disabled={!hasAnswer}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1.5">
              {isLast ? 'Continue to Self-Assessment' : 'Next'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Self Assessment Phase ---
  if (phase === 'self_assessment') {
    return (
      <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground mb-6">
            <X className="w-5 h-5" />
          </button>

          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Brain className="w-7 h-7 text-primary" />
            </div>
            <h2 className="font-heading text-xl font-bold mb-1">Self-Assessment</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Rate your proficiency on each topic. Be honest — this helps identify knowledge gaps.
            </p>
          </div>

          <div className="space-y-4 mb-8">
            {selfAssessmentTopics.map((topic, idx) => (
              <div key={idx} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-foreground">{topic.topic}</p>
                  <label className="flex items-center gap-1.5 text-xs">
                    <input type="checkbox" checked={selfCovered[idx] !== false}
                      onChange={e => setSelfCovered(prev => ({ ...prev, [idx]: e.target.checked }))}
                      className="rounded" />
                    <span className="text-muted-foreground">Covered</span>
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-8">0%</span>
                  <input type="range" min="0" max="100" step="10" value={selfRatings[idx] || 0}
                    onChange={e => setSelfRatings(prev => ({ ...prev, [idx]: Number(e.target.value) }))}
                    className="flex-1 accent-primary" />
                  <span className="text-xs font-bold text-primary w-10 text-right">{selfRatings[idx] || 0}%</span>
                </div>
              </div>
            ))}
          </div>

          <button onClick={submitReview} disabled={generating}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
            {generating ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing Review...</> : 'Submit & See Results'}
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function ScoreCard({ icon: Icon, label, value, color }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-center">
      <Icon className={`w-4 h-4 mx-auto mb-2 ${color}`} />
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`font-heading text-xl font-bold ${color}`}>{value}%</p>
    </div>
  );
}