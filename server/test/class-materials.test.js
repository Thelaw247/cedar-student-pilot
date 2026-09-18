import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MAX_MATERIALS_PER_CLASS, MAX_MATERIALS_PER_LECTURE } from '../lib/lectureMaterials.js';

/**
 * A professor's file can belong to the course, not only to one lecture.
 *
 * The syllabus, a formula sheet, a past exam: the files a student most wants
 * questions built from, and until now the only way to attach one was to hang
 * it on some lecture. One constraint loosened (lecture_id nullable), one
 * alternative target on the same two endpoints, the same gate, the same
 * 1-credit PDF read, the same delete path — and the lecture page's own
 * materials and the enrichment pass still see only a lecture's own files.
 */

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const ROUTE = read('../routes/lectureMaterials.js');
const LIB = read('../lib/lectureMaterials.js');
const CLIENT = read('../../src/lib/cedarClient.js');
const WIDGET = read('../../src/components/lecture/LectureMaterials.jsx');
const CLASS_PAGE = read('../../src/pages/ClassDetail.jsx');
const LECTURE_PAGE = read('../../src/pages/LectureDetail.jsx');
const DELETE = read('../routes/deleteAcademicData.js');

test('the migration loosens exactly one constraint and is committed to the repo', () => {
  const files = fs.readdirSync(new URL('../../supabase/migrations/', import.meta.url)).filter((f) => f.includes('class_level_materials'));
  assert.equal(files.length, 1, 'the class-level materials migration file is missing');
  const sql = read(`../../supabase/migrations/${files[0]}`);
  assert.match(sql, /alter table public\.lecture_materials\s+alter column lecture_id drop not null;/);
  assert.doesNotMatch(sql, /class_id drop not null/, 'class_id must stay required: it is what the cascade and the delete routes key on');
  assert.doesNotMatch(sql, /drop policy|create policy/, 'RLS is untouched — it never read lecture_id');
  const types = read('../../supabase/database.types.ts');
  const block = types.slice(types.indexOf('lecture_materials: {'), types.indexOf('lecture_materials_class_id_fkey'));
  assert.equal((block.match(/lecture_id\??: string \| null/g) || []).length, 3, 'Row, Insert and Update must all allow a null lecture_id');
});

test('both endpoints accept a class as the target, resolved through the student\'s own rows', () => {
  assert.match(ROUTE, /async function ownedClass\(userId, classId\)/);
  assert.match(ROUTE, /select id from classes where id = \$1 and user_id = \$2/);
  assert.match(ROUTE, /async function resolveTarget\(userId, body\)/);
  // A body naming both is a lecture file (the lecture carries its class);
  // a body naming only class_id is a class file with no lecture.
  assert.match(ROUTE, /if \(body\?\.lecture_id\) \{[\s\S]*return lecture \? \{ lecture_id: lecture\.id, class_id: lecture\.class_id \} : null;/);
  assert.match(ROUTE, /if \(body\?\.class_id\) \{[\s\S]*return cls \? \{ lecture_id: null, class_id: cls\.id \} : null;/);
  const uploadUrl = ROUTE.slice(ROUTE.indexOf("router.post('/upload-url'"), ROUTE.indexOf("router.post('/confirm'"));
  const confirm = ROUTE.slice(ROUTE.indexOf("router.post('/confirm'"), ROUTE.indexOf("router.get('/download-url'"));
  for (const [name, handler] of [['upload-url', uploadUrl], ['confirm', confirm]]) {
    assert.match(handler, /const target = await resolveTarget\(req\.user\.id, req\.body\);|const target = await resolveTarget\(userId, req\.body\);/, `${name} does not resolve the target`);
    assert.match(handler, /if \(!target\) return res\.status\(404\)/, `${name} must 404 before any work when the target is not the student's`);
    assert.doesNotMatch(handler, /ownedLecture\(req\.user\.id, req\.body\?\.lecture_id\)/, `${name} still resolves only lectures`);
  }
  // The row is written from the resolved target, so a class file has no lecture.
  assert.match(confirm, /\[userId, target\.lecture_id, target\.class_id, fileName,/);
});

test('the gate is the same for both targets, and the class has its own cap', () => {
  assert.match(ROUTE, /async function gateMaterial\(userId, contentType, target, res\)/);
  const gate = ROUTE.slice(ROUTE.indexOf('async function gateMaterial'), ROUTE.indexOf("router.post('/upload-url'"));
  assert.match(gate, /gateFeature\(userId, 'material_extract'/);
  assert.match(gate, /requireTier\(userId, 'material_extract'/);
  assert.equal(MAX_MATERIALS_PER_LECTURE, 12, 'the per-lecture cap changed');
  assert.equal(MAX_MATERIALS_PER_CLASS, 30);
  assert.match(LIB, /export const MAX_MATERIALS_PER_CLASS = 30;/);
  assert.match(ROUTE, /where class_id = \$1 and lecture_id is null/, 'the class cap must count only class-level files, not every file of the class');
});

test('the client sends one target and keeps the original lecture-id call shape', () => {
  assert.match(CLIENT, /async upload\(target, file\)/);
  assert.match(CLIENT, /typeof target === 'string' \? \{ lecture_id: target \}/);
  assert.match(CLIENT, /if \(!scope\.lecture_id && !scope\.class_id\) throw new TypeError/);
  // The recording island still uploads with a bare lecture id.
  const CONTEXT = read('../../src/recording/RecordingContext.jsx');
  assert.match(CONTEXT, /base44\.materials\.upload\(lectureId, file\)/);
});

test('the class page shows course materials; the lecture page is unchanged', () => {
  assert.match(CLASS_PAGE, /import LectureMaterials from '@\/components\/lecture\/LectureMaterials';/);
  assert.match(CLASS_PAGE, /<LectureMaterials cls=\{cls\} lectures=\{lectures\} \/>/);
  assert.match(LECTURE_PAGE, /<LectureMaterials\s+lecture=/, 'the lecture page must keep lecture scope');
  // Class scope: all files of the class, uploads go to the class, no re-check.
  assert.match(WIDGET, /classScope \? \{ class_id: scopeId \} : \{ lecture_id: scopeId \}/);
  assert.match(WIDGET, /base44\.materials\.upload\(classScope \? \{ class_id: scopeId \} : scopeId, file\)/);
  assert.match(WIDGET, /\{!classScope && loaded && lecture\?\.transcript && readyCount > 0 && \(/, 're-check must stay a lecture-scope action');
  assert.match(WIDGET, /to=\{`\/lectures\/\$\{m\.lecture_id\}`\}/, 'a lecture file listed on the class page must link to its lecture');
});

test('what does not change: enrichment reads a lecture\'s own files, and deletes still take every file', () => {
  assert.match(LIB, /from lecture_materials where lecture_id = \$1 and user_id = \$2 order by created_at/, 'loadLectureMaterials must stay lecture-scoped');
  // Every delete route collects refs by class, so a class-level file is never stranded.
  const classRoute = DELETE.slice(DELETE.indexOf("router.delete('/classes/:id'"), DELETE.indexOf("router.delete('/semesters/:id'"));
  assert.match(classRoute, /from lecture_materials where class_id = \$1 and user_id = \$2/);
  const SEM = read('../lib/semesterDelete.js');
  assert.match(SEM, /from lecture_materials where class_id = any\(\$1::uuid\[\]\) and user_id = \$2/);
});
