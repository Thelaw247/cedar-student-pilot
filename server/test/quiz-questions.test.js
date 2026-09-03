import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normalizeQuizQuestions, OPTIONS_PER_QUESTION } from '../lib/quizQuestions.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const good = {
  type: 'multiple_choice',
  question: 'What does Newton\'s second law relate?',
  options: ['Force, mass and acceleration', 'Energy and time', 'Charge and voltage', 'Pressure and volume'],
  correct_answer: 'Force, mass and acceleration',
  explanation: 'F = ma links the net force on a body to its mass and acceleration.',
  concept: 'Newton\'s laws',
  lecture_index: 1,
  flow_position: 'start',
};

test('the blank question that reached a student on 2 Sep is dropped', () => {
  const { questions, dropped } = normalizeQuizQuestions([
    { type: '', question: '', options: [], correct_answer: '' },
    good,
  ]);
  assert.equal(questions.length, 1);
  assert.equal(dropped, 1);
  assert.equal(questions[0].type, 'multiple_choice');
});

test('free-text question types never survive, whatever the model says', () => {
  const { questions } = normalizeQuizQuestions([
    { type: 'short_answer', question: 'Explain entropy.', options: [], correct_answer: 'Disorder' },
    { type: 'one_word', question: 'Name the unit of force.', options: [], correct_answer: 'Newton' },
    { type: 'problem', question: 'Solve for x.', options: [], correct_answer: '4' },
    { ...good, type: 'true_false', options: ['True', 'False'], correct_answer: 'True' },
  ]);
  // The true/false one has two distinct options and a matching answer, so it
  // is kept — but as multiple choice; the client has one renderer.
  assert.equal(questions.length, 1);
  assert.equal(questions[0].type, 'multiple_choice');
});

test('a correct answer that is not one of the options is a dropped question', () => {
  const { questions, dropped } = normalizeQuizQuestions([{ ...good, correct_answer: 'Momentum' }]);
  assert.equal(questions.length, 0);
  assert.equal(dropped, 1);
});

test('the answer key matches an option case- and whitespace-insensitively', () => {
  const { questions } = normalizeQuizQuestions([{ ...good, correct_answer: '  force, MASS and acceleration ' }]);
  assert.equal(questions[0].correct_answer, 'Force, mass and acceleration');
  assert.ok(questions[0].options.includes(questions[0].correct_answer));
});

test('duplicate options and duplicate questions collapse', () => {
  const { questions } = normalizeQuizQuestions([
    { ...good, options: ['A', 'a', 'B', 'C', 'D', 'E'], correct_answer: 'B' },
    { ...good, options: ['A', 'B'], correct_answer: 'A' },
  ]);
  assert.equal(questions.length, 1);
  assert.equal(questions[0].options.length, OPTIONS_PER_QUESTION);
  assert.equal(new Set(questions[0].options.map((o) => o.toLowerCase())).size, OPTIONS_PER_QUESTION);
});

test('options are shuffled deterministically and the answer survives the shuffle', () => {
  const a = normalizeQuizQuestions([good]).questions[0];
  const b = normalizeQuizQuestions([good]).questions[0];
  assert.deepEqual(a.options, b.options);
  assert.ok(a.options.includes(a.correct_answer));
  assert.equal(a.options.length, OPTIONS_PER_QUESTION);
});

test('keep caps the number of questions returned', () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ ...good, question: `Q${i}?` }));
  assert.equal(normalizeQuizQuestions(many, { keep: 5 }).questions.length, 5);
});

test('every quiz generator route runs its questions through the normalizer', () => {
  for (const route of ['server/routes/generateLectureReview.js', 'server/routes/generateSessionReview.js']) {
    const source = read(route);
    assert.match(source, /normalizeQuizQuestions\(/, `${route} must validate model output`);
    assert.match(source, /QUIZ_FORMAT_RULES/, `${route} must use the shared multiple-choice rules`);
  }
});

test('no quiz screen renders a free-text answer box any more', () => {
  for (const file of [
    'src/pages/LectureReview.jsx',
    'src/components/InLectureQuiz.jsx',
    'src/components/HandbookReader.jsx',
    'src/components/SessionReview.jsx',
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /Type your answer/, `${file} still offers a typed answer`);
    assert.doesNotMatch(source, /grade_answers/, `${file} still calls the written-answer grader`);
  }
});
