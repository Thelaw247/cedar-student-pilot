import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeQuizQuestions, QUIZ_FORMAT_RULES } from '../lib/quizQuestions.js';
import { buildStudyMaterialPrompt, STUDY_MATERIALS_CHARS } from '../lib/studyMaterial.js';
import { materialsForPrompt } from '../lib/lectureEnrichment.js';

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
// The prompt moved out of the route into lib/studyMaterial.js on 18 Sep
// 2026, when the professor's files became a second source, so that a
// lectures-only prompt could be held to a frozen copy of the original.
const PROMPT_LIB = read('../lib/studyMaterial.js');
// The client half of this moved into StudyToolbox when the four generation
// tools were extracted out of PracticePanel (phase 4). Same code, same
// requirement — the file it lives in is not the point.
const TOOLBOX = read('../../src/components/StudyToolbox.jsx');
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
  assert.match(PROMPT_LIB, /QUIZ_FORMAT_RULES/);
  assert.match(ROUTE, /prompt: buildStudyMaterialPrompt\(\{ material_type, lectureContent, materials \}\)/);
  assert.match(ROUTE, /items: QUIZ_QUESTION_SCHEMA/);
  assert.doesNotMatch(ROUTE + PROMPT_LIB, /multiple choice and short answer/);
});

test('a failure is visible in all three places it used to be invisible', () => {
  assert.match(ROUTE, /console\.error\('\[study-material\]', error\)/);
  // A run that produces nothing usable is a genuine failure, and is recorded
  // as one: success false with no refusal, which is what the owner dashboard
  // separates from a paywall stop.
  assert.match(ROUTE, /logUsage\(\{ user_id: userId, feature: 'study_material', tier_at_time: gate\.balance\?\.tier, success: false \}\)/);
  assert.doesNotMatch(ROUTE.slice(ROUTE.indexOf('questions.length === 0')), /refusal/);
  // And the client stops overwriting whatever the server said.
  assert.match(TOOLBOX, /e\?\.response\?\.data\?\.message \|\| e\?\.response\?\.data\?\.error/);
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

/**
 * The professor's files as a second source (18 Sep 2026).
 *
 * The syllabus, a formula sheet, a past exam: the files a student most wants
 * questions built from. The generator now reads them beside the lecture
 * summaries, chosen per run. The rule that makes this a pure addition: a
 * run that names no files is the run it always was, down to the prompt.
 */

// The prompt exactly as the route built it before files existed — the old
// template literal, copied, not derived. If buildStudyMaterialPrompt drifts
// for the no-files case, this is what catches it.
const legacyPrompt = (material_type, lectureContent) => `You are an AI study material generator. Based on the following university lecture content, generate study material of type "${material_type}".

Lecture content:
${lectureContent.substring(0, 12000)}

Generate ${material_type} based on this content:
- If "flashcards": Generate 10 flashcards with front (question/term) and back (answer/definition)
- If "quiz": Generate 5 questions
- If "practice_test": Generate 8 questions covering the full range of the material
- If "summary_sheet": Generate a comprehensive study summary with key points, organized by topic

${material_type === 'quiz' || material_type === 'practice_test' ? QUIZ_FORMAT_RULES : ''}

Return the appropriate JSON structure.`;

const LECTURES = `Lecture 2026-09-10 - Kirchhoff's laws:\nCurrents into a node sum to zero.\n\n---\n\nLecture 2026-09-12 - Thevenin:\n${'Any linear network reduces to one source and one resistor. '.repeat(400)}`;
const FILES = [
  { id: 'f1', file_name: 'formula-sheet.pdf', text: 'V = IR\nP = VI' },
  { id: 'f2', file_name: 'midterm-2025.pdf', text: 'Q1. Find the Thevenin equivalent.' },
];

test('lectures only: the prompt is byte-identical to the one the route always sent', () => {
  assert.ok(LECTURES.length > 12000, 'the fixture must be long enough to exercise the 12k cap');
  for (const type of ['flashcards', 'practice_test', 'summary_sheet', 'quiz']) {
    assert.equal(buildStudyMaterialPrompt({ material_type: type, lectureContent: LECTURES, materials: [] }), legacyPrompt(type, LECTURES));
    assert.equal(buildStudyMaterialPrompt({ material_type: type, lectureContent: LECTURES }), legacyPrompt(type, LECTURES), 'materials must default to none');
  }
});

test('files only: the prompt names the files as the source and carries no empty lecture block', () => {
  const p = buildStudyMaterialPrompt({ material_type: 'practice_test', lectureContent: '', materials: FILES });
  assert.match(p, /Based on the following university course materials, generate study material of type "practice_test"\./);
  assert.doesNotMatch(p, /Lecture content:/);
  assert.match(p, /=== formula-sheet\.pdf ===\nV = IR\nP = VI/);
  assert.match(p, /=== midterm-2025\.pdf ===\nQ1\./);
  assert.match(p, /when they and the lecture notes disagree, the files are right/);
  assert.match(p, /Question format \(strict\)/, 'the question rules still apply');
});

test('both: two blocks, lectures first, and the phrase that names the sources says so', () => {
  const p = buildStudyMaterialPrompt({ material_type: 'flashcards', lectureContent: LECTURES, materials: FILES });
  assert.match(p, /Based on the following university lecture content and course materials,/);
  const lecturesAt = p.indexOf('Lecture content:\n');
  const filesAt = p.indexOf('Course materials (');
  const generateAt = p.indexOf('Generate flashcards based on this content:');
  assert.ok(lecturesAt > 0 && lecturesAt < filesAt && filesAt < generateAt);
  // The lecture block keeps its own 12k cap regardless of the files.
  assert.equal(filesAt - lecturesAt, 'Lecture content:\n'.length + 12000 + '\n\n'.length);
});

test('the files respect their own budget, and the enrichment pass keeps its larger one', () => {
  const rows = [
    { id: 'a', file_name: 'a.pdf', extraction_status: 'ready', extracted_text: 'x'.repeat(50) },
    { id: 'b', file_name: 'scan.pdf', extraction_status: 'failed', extracted_text: null },
    { id: 'c', file_name: 'c.pdf', extraction_status: 'ready', extracted_text: 'y'.repeat(500) },
    { id: 'd', file_name: 'd.pdf', extraction_status: 'ready', extracted_text: 'z' },
  ];
  const small = materialsForPrompt(rows, 100);
  assert.deepEqual(small.map((m) => m.id), ['a', 'c'], 'a file with no readable text is never a source, and the budget stops the list');
  assert.equal(small.reduce((n, m) => n + m.text.length, 0), 100);
  // Unchanged default: the enrichment pass gets everything it always did.
  const full = materialsForPrompt(rows);
  assert.deepEqual(full.map((m) => m.id), ['a', 'c', 'd']);
  assert.equal(full[1].text.length, 500);
  assert.ok(STUDY_MATERIALS_CHARS > 0 && STUDY_MATERIALS_CHARS < 140_000, 'the generator runs on the cheap chain for one credit; it must read less than the enrichment pass');
  assert.match(ROUTE, /materialsForPrompt\(rows, STUDY_MATERIALS_CHARS\)/);
  // Shortest first, so a one-page formula sheet is never crowded out.
  assert.match(ROUTE, /rows\.sort\(\(a, b\) => \(a\.extracted_text\?\.length \|\| 0\) - \(b\.extracted_text\?\.length \|\| 0\)\)/);
});

test('files from another class, or another student, are not found — not leaked', () => {
  assert.match(ROUTE, /from lecture_materials\s+where id = any\(\$1::uuid\[\]\) and class_id = \$2 and user_id = \$3/);
  assert.match(ROUTE, /\[ids, class_id, userId\]/);
  // A malformed id is dropped before the cast rather than becoming a 500,
  // and the list is capped at what one class can hold.
  assert.match(ROUTE, /UUID\.test\(id\)/);
  assert.match(ROUTE, /\.slice\(0, MAX_MATERIALS_PER_CLASS\)/);
});

test('the request without files is handled exactly as before, and files alone are enough', () => {
  // Lectures: subset, range, whole class — untouched.
  assert.match(ROUTE, /if \(Array\.isArray\(lecture_ids\) && lecture_ids\.length > 0\)/);
  assert.match(ROUTE, /else if \(lecture_range_start && lecture_range_end\)/);
  // Files alone: no_lectures skips the lecture read entirely.
  assert.match(ROUTE, /let lectures = no_lectures === true\s+\? \[\]/);
  // 400 only when there is nothing at all to build from; the old message for
  // the old request, a specific one when files were chosen but unreadable.
  assert.match(ROUTE, /if \(!lectureContent && materials\.length === 0\)/);
  assert.match(ROUTE, /'No lecture content available to generate study material'/);
  assert.match(ROUTE, /None of the chosen files has readable text/);
  // Sources are settled before the gate: a run that cannot happen is never
  // charged, and the settle still comes after the rows are stored.
  const materialsAt = ROUTE.indexOf('materialsForPrompt(rows');
  const emptyAt = ROUTE.indexOf('!lectureContent && materials.length === 0');
  const gateAt = ROUTE.indexOf('await gateFeature');
  const insertAt = ROUTE.lastIndexOf('insert into practice_questions');
  const settleAt = ROUTE.indexOf('await settleFeature');
  assert.ok(materialsAt < emptyAt && emptyAt < gateAt && gateAt < insertAt && insertAt < settleAt);
  // Same feature, same price. No new cost entry for a file-fed run.
  assert.match(ROUTE, /gateFeature\(userId, 'study_material', res\)/);
  const CREDITS = read('../lib/credits.js');
  assert.match(CREDITS, /study_material: 1,/);
  assert.doesNotMatch(CREDITS, /study_material_/);
  // The response names the files actually read — only when files were asked for.
  assert.match(ROUTE, /\.\.\.\(materialsRequested \? \{ materials_used: materials\.map/);
});

test('the client names files only when the student chose some', () => {
  assert.match(TOOLBOX, /const materialIds = resolveMaterialIds \? resolveMaterialIds\(\) : \[\]/);
  assert.match(TOOLBOX, /\.\.\.\(materialIds\.length \? \{ material_ids: materialIds, \.\.\.\(ids === null \? \{ no_lectures: true \} : \{\}\) \} : \{\}\)/);
  assert.match(TOOLBOX, /lecture_ids: ids \|\| \[\]/);
  // Files with no lectures is a valid scope; nothing at all is not.
  assert.match(TOOLBOX, /if \(ids === null && materialIds\.length === 0\) \{ setResult\(\{ error:/);
  assert.match(TOOLBOX, /result\.materials_used/);
  const PANEL = read('../../src/components/PracticePanel.jsx');
  const PICKER = read('../../src/components/MaterialScopePicker.jsx');
  assert.equal((PANEL.match(/<MaterialScopePicker/g) || []).length, 1);
  assert.match(PANEL, /resolveMaterialIds=\{filesForGeneration\}/);
  assert.match(PANEL, /const filesForGeneration = \(\) => resolveMaterialIds\(materialIds, materials\)/);
  assert.match(PANEL, /setMaterialIds\(\[\]\); \/\/ and the file choice to none/, 'switching class must drop the file choice');
  assert.match(PANEL, /LectureMaterial\.filter\(\{ class_id: id \}\)/);
  // Only readable files are offered, none are chosen by default, and a
  // lecture-attached file says which lecture it came from.
  assert.match(PICKER, /extraction_status === 'ready'/);
  assert.match(PICKER, /if \(readable\.length === 0\) return null;/);
  assert.match(PANEL, /const \[materialIds, setMaterialIds\] = useState\(\[\]\)/);
  assert.match(PICKER, /from \$\{lecture\}/);
  // The runners on the shelf take lectures; the file choice never reaches the URL.
  assert.doesNotMatch(PANEL, /onScopeChange\(\{[^}]*material/);
});
