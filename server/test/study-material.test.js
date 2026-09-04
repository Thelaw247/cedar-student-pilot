import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeQuizQuestions } from '../lib/quizQuestions.js';

/**
 * Quiz and Practice Test in Study > Practice had never once worked. Not
 * "sometimes" — usage_events held zero study_material rows of any kind, for
 * any student, since the feature shipped.
 *
 * The route sent the model's reply straight into practice_questions:
 *   question text not null,
 *   answer   text not null,
 *   type     text not null check (type in ('multiple_choice','short_answer'))
 * so a reply naming its field `correct_answer` (what every other generator
 * in this codebase calls it), or typing itself "multiple-choice", or holding
 * one empty question, aborted the whole insert. The flashcard branch of the
 * same route had a guard for exactly this shape of problem; the question
 * branch had none.
 *
 * And it failed silently three times over: no console line, no usage_events
 * row (the throw lands between gateFeature and settleFeature, so neither
 * writes one), and a client that threw away the server's message.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const ROUTE = read('../routes/generateStudyMaterial.js');
const PANEL = read('../../src/components/PracticePanel.jsx');
const VIEWER = read('../../src/components/QuizViewer.jsx');

test('nothing reaches practice_questions without passing the validator', () => {
  const insertAt = ROUTE.indexOf('insert into practice_questions');
  const normalizeAt = ROUTE.indexOf('normalizeQuizQuestions(material.questions)');
  assert.ok(normalizeAt > -1, 'the question branch is unvalidated again');
  assert.ok(normalizeAt < insertAt, 'the validator must run before the insert');
  // The validator's output, not the model's.
  assert.match(ROUTE, /const stored = questions\.map/);
  assert.doesNotMatch(ROUTE, /q\.answer, q\.options \|\| \[\], q\.type \|\| 'multiple_choice'/);
});

test('the three replies that used to take the route down are all handled', () => {
  const { questions, dropped } = normalizeQuizQuestions([
    // 1. The field is correct_answer, which is what the schema now asks for.
    { question: 'What does Ohm’s law relate?', options: ['V, I and R', 'P and t', 'Q and C', 'f and λ'], correct_answer: 'V, I and R' },
    // 2. A type the CHECK constraint would have rejected. Never stored —
    //    the validator emits multiple_choice and the route hard-codes it.
    { question: 'Define impedance.', type: 'multiple-choice', options: ['Opposition to AC', 'Only resistance', 'Only reactance', 'Power factor'], correct_answer: 'Opposition to AC' },
    // 3. Empty question text — a NOT NULL violation, now a drop.
    { question: '   ', options: ['a', 'b', 'c', 'd'], correct_answer: 'a' },
  ]);
  assert.equal(questions.length, 2);
  assert.equal(dropped, 1);
  for (const q of questions) {
    assert.equal(q.type, 'multiple_choice', 'a type the CHECK constraint rejects got through');
    assert.ok(q.question.trim().length > 0, 'an empty question would violate NOT NULL');
    assert.ok(q.options.includes(q.correct_answer), 'the answer must be one of the options');
  }
});

test('a labelled answer is matched, not dropped', () => {
  // "B) Faraday's law" against bare options was the failure that produced an
  // empty review in September; the same reply shape reaches this route.
  const { questions } = normalizeQuizQuestions([
    { question: 'Which law governs induced EMF?', options: ["Faraday's law", "Ohm's law", "Gauss's law", "Lenz's law"], correct_answer: "B) Faraday's law" },
  ]);
  assert.equal(questions.length, 1);
  assert.equal(questions[0].correct_answer, "Faraday's law");
});

test('the prompt asks for the one question format the product supports', () => {
  // It used to ask practice_test for "mixed questions (multiple choice and
  // short answer)" in prose, with a free-string type in the schema — an
  // invitation to return the exact value the CHECK constraint forbids.
  assert.match(ROUTE, /QUIZ_FORMAT_RULES/);
  assert.match(ROUTE, /items: QUIZ_QUESTION_SCHEMA/);
  assert.doesNotMatch(ROUTE, /multiple choice and short answer/);
});

test('a failure is visible in all three places it used to be invisible', () => {
  assert.match(ROUTE, /console\.error\('\[study-material\]', error\)/);
  // A run that produces nothing usable is a genuine failure, and is recorded
  // as one: success false with no refusal, which is what the owner dashboard
  // separates from a paywall stop.
  assert.match(ROUTE, /logUsage\(\{ user_id: userId, feature: 'study_material', tier_at_time: gate\.balance\?\.tier, success: false \}\)/);
  assert.doesNotMatch(ROUTE.slice(ROUTE.indexOf('questions.length === 0')), /refusal/);
  // And the client stops overwriting whatever the server said.
  assert.match(PANEL, /e\?\.response\?\.data\?\.message \|\| e\?\.response\?\.data\?\.error/);
});

test('the student is not charged for a run that produced nothing', () => {
  // settleFeature is the only thing that spends credits, and the empty-result
  // branch returns before reaching it.
  const emptyBranch = ROUTE.indexOf('questions.length === 0');
  const settleAt = ROUTE.indexOf('await settleFeature');
  assert.ok(emptyBranch < settleAt);
  assert.match(ROUTE, /you have not been charged/);
});

test('the quiz viewer no longer marks a right answer wrong over whitespace', () => {
  assert.doesNotMatch(VIEWER, /opt === q\.answer/);
  assert.doesNotMatch(VIEWER, /q\.options\[optionIdx\] === q\.answer/);
  assert.match(VIEWER, /const sameAnswer = /);
  assert.equal((VIEWER.match(/sameAnswer\(/g) || []).length, 2, 'both comparison sites must use it');
});
