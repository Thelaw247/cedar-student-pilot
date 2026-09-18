import { QUIZ_FORMAT_RULES } from './quizQuestions.js';

/**
 * The study-material generator's prompt, and what it is allowed to read.
 *
 * Until 18 Sep 2026 the generator built from lecture summaries only. It now
 * also takes the professor's own files — the syllabus, a formula sheet, a
 * past exam — chosen by the student from the class's materials. The rule
 * that keeps this a pure addition: a request without files produces the
 * prompt it always did, byte for byte (the test holds a frozen copy). Files
 * only add a second source block and change the one phrase that names the
 * sources.
 */

/**
 * Total characters of extracted text the generator will read across the
 * chosen files. The enrichment pass allows 140k on the quality model inside
 * the per-lecture processing charge; this runs on the cheap chain for one
 * credit, so 60k (about 15k tokens, well under a cent on either model in
 * the chain) keeps a file-fed run under the lecture rate, which is the
 * ceiling every credit price in lib/credits.js is held to.
 */
export const STUDY_MATERIALS_CHARS = 60_000;

/** The lecture block's cap. Unchanged since the Base44 port. */
export const STUDY_LECTURE_CHARS = 12_000;

/**
 * @param {object} input
 * @param {string} input.material_type   flashcards | quiz | practice_test | summary_sheet
 * @param {string} input.lectureContent  the joined lecture summaries ('' for none)
 * @param {{ file_name: string, text: string }[]} [input.materials]  from materialsForPrompt
 */
export function buildStudyMaterialPrompt({ material_type, lectureContent, materials = [] }) {
  const sources = [];
  if (lectureContent) sources.push(`Lecture content:\n${lectureContent.substring(0, STUDY_LECTURE_CHARS)}`);
  if (materials.length) {
    const block = materials.map((m) => `=== ${m.file_name} ===\n${m.text}`).join('\n\n');
    sources.push(`Course materials (the professor's own files — when they and the lecture notes disagree, the files are right; prefer their wording for definitions and formulas):\n${block}`);
  }
  const label = lectureContent && materials.length ? 'lecture content and course materials'
    : materials.length ? 'course materials'
      : 'lecture content';

  return `You are an AI study material generator. Based on the following university ${label}, generate study material of type "${material_type}".

${sources.join('\n\n')}

Generate ${material_type} based on this content:
- If "flashcards": Generate 10 flashcards with front (question/term) and back (answer/definition)
- If "quiz": Generate 5 questions
- If "practice_test": Generate 8 questions covering the full range of the material
- If "summary_sheet": Generate a comprehensive study summary with key points, organized by topic

${material_type === 'quiz' || material_type === 'practice_test' ? QUIZ_FORMAT_RULES : ''}

Return the appropriate JSON structure.`;
}
