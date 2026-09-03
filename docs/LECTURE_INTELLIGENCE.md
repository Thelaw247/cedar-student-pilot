# Lecture intelligence — pipeline audit and the study page

_3 September 2026. Written after the first real lectures were recorded with the app (1–2 Sep) and the first review session opened on a blank question._

## 1. What the pipeline did before this work

```
browser MediaRecorder (32 kbps Opus, 90-min segments)
  → R2 (presigned PUT, owner-stamped)
  → POST /process-lecture-recording (202, background)
      1. fetch + verify each segment, measure duration (billing)
      2. transcribe: Groq whisper-large-v3-turbo, Deepgram when Groq refuses
      3. store transcript (resume point)
      4. extractFromTranscript: QUALITY_MODEL, transcript split into
         15 000-character chunks, one call per chunk, then a merge:
           title, summary (2–3 paragraphs), concepts[], vocabulary[],
           definitions[{term, definition}], formulas[] (strings),
           action_items[], exam_mentions[]
         multi-chunk: string-dedupe per list, one extra call to stitch
         the chunk summaries into one
      5. status = 'complete'
      6. 8 flashcards from concepts + definitions + formulas
      7. bill once (usage ledger + applied_credit_operations)
```

Everything downstream — the lecture page, reviews, quizzes, handbooks,
exam prediction, session reviews — reads those eight flat columns plus the
raw transcript.

## 2. Where information was lost (audit findings)

| # | Finding | Effect on the student |
|---|---------|-----------------------|
| A1 | **Chunked extraction with string merge.** A 90-minute lecture is ~60k characters → four independent 15k chunks. Each chunk is asked for "5–10 concepts", so the merged list is capped by dedupe and ordered by chunk, not by importance. Nothing crosses chunk boundaries. | Concepts introduced late are under-represented; the same concept phrased differently in two chunks appears twice; the summary is a summary of summaries. |
| A2 | **No structure.** Output is eight flat lists. There is no outline, no ordering, no "this was the middle part", no examples the professor worked through. | The page is a wall of chips. A student cannot skim it, cannot see what came before what, cannot find the worked example they half-remember. |
| A3 | **No provenance.** Nothing says where in the recording a concept or formula was said. | No way to verify a claim or to listen to the exact moment. Trust is "take the AI's word for it". |
| A4 | **Formulas stored as heard.** `formulas: string[]`, taken from a speech-to-text of the professor talking. "Sigma equals F over A" survives; "epsilon equals delta L over L" often becomes "epsilon equals delta L over L" or "delta L over L". Symbols, subscripts and Greek letters are guesses. No variables, no units, no meaning. | Exactly the kind of content students study from and exactly the kind the transcription is worst at. |
| A5 | **No use of the professor's own materials.** Slides and handouts are the ground truth for formulas, definitions, notation and what will be examined, and the app had no place to put them. | The most accurate source available was never consulted. |
| A6 | **Action items are dead text.** `ai_action_items` rendered as bullets on one page; no state, no dates, no list across lectures. | "Read chapter 3.2 before Thursday" is displayed once and forgotten. |
| A7 | **Exam mentions are flat.** No importance, no anchor. | A throwaway "this might come up" and "the midterm is entirely on this" look identical. |
| A8 | **Review questions were not validated.** The generators asked for a mix of multiple-choice, true/false, short-answer and problem types and passed the model's array straight to the client. | 2 Sep: "Question 1 of 10" with no text, an empty type badge and a text box. |
| A9 | **Written-answer grading round trip.** Short answers were sent back to the model to grade — a second call, a second failure mode, and a screen that says "Grading…" | Slower reviews; the results page had to hedge ("model answer") instead of stating the answer. |
| A10 | **The transcript is the only deep artefact and it is unnavigable.** A collapsed `<p>` of 12 000 words with no search. | Nobody reads it. |

Things that were already right and are kept as-is: transcription is persisted before analysis (a failed analysis never re-pays for transcription); billing is idempotent; the claim/release state machine for background processing; the WebM gap-closing so silent minutes are neither billed nor transcribed; flashcard generation survives partial model output.

## 3. What changed

### 3.1 Reviews: multiple choice only, validated, misses first (A8, A9)

- `server/lib/quizQuestions.js` — `normalizeQuizQuestions()` keeps a question only if it has text, at least two distinct options and an answer that is one of them; drops the rest; caps at four options; shuffles them deterministically (models put the answer first); requires an `explanation`. `QUIZ_FORMAT_RULES` and `QUIZ_QUESTION_SCHEMA` are the one definition both generators use.
- `generateLectureReview` and `generateSessionReview` ask for multiple choice only. Quantitative classes still get problems — posed as a problem statement with four candidate final answers whose distractors are the classic mistakes.
- `src/components/quiz/QuizReview.jsx` — the one results component: **what you got wrong** first (your pick, the right one, the explanation), correct answers folded under a toggle. `ChoiceOptions` is the one option renderer. Used by the lecture review page, the quick quiz, the handbook quiz and the session review.
- The written-answer grading path is gone from every screen (the server route keeps its grading mode only for an old client that might still hold answers).
- `server/test/quiz-questions.test.js` pins all of it, including "no quiz screen renders a text box".

### 3.2 The enrichment pass (A1–A4, A7)

`server/lib/lectureEnrichment.js`, run by `processLectureRecording` after the base analysis and on demand by `POST /enrich-lecture`.

One call over the **whole transcript** (up to 200k characters; the quality model's context is far larger than the old 15k chunks) plus the attached materials, producing `lectures.ai_enrichment`:

| Field | What it is |
|-------|------------|
| `one_liner`, `key_takeaways[]` | The lecture in a sentence; 5–10 things to remember |
| `outline[]` | 5–15 sections in teaching order: heading, summary, key points, **anchor** |
| `concepts[]` | Every concept: explanation (teaches it), why it matters, difficulty (core / supporting / advanced), related concepts (validated to exist), a **search query**, **anchor** |
| `formulas[]` | Every formula: plain expression, LaTeX, meaning, when to use, **variables with meaning and unit**, **anchor**, `source`, `verified` |
| `definitions[]` | Every defined term with `source`, `verified`, **anchor** |
| `examples[]` | Worked examples: problem, steps, answer, **anchor** |
| `exam_radar[]` | Everything said about assessment, with importance high / medium / low, **anchor** |
| `misconceptions[]`, `questions[]` | What students get wrong; what is worth asking the prof or TA |
| `todos[]` | Tasks the professor actually assigned, typed (read / practice / submit / review / prepare) with the due hint as said |
| `stats` | anchors resolved / total, verified counts — for monitoring model drift |

**Anchors.** The model is asked for a 6–14 word verbatim quote per item. The server resolves each quote to a character offset in the transcript (`locateQuote`: punctuation- and case-insensitive projection with an offset map, falling back to the first six / last four words). Unresolved quotes get `offset: -1` and the UI shows no link — a wrong jump is worse than none.

**Verification (A4, A5).** A formula or definition is `verified: true` only when the code finds the model's `material_quote` — or the expression / term itself — in the extracted text of an attached material. The model's own `source: "material"` claim is recorded as `claimed_material` for debugging and never trusted. Without materials nothing is verified, whatever the model says. The prompt tells the model the materials are authoritative when they disagree with the transcript, and to reconstruct standard notation where the speech-to-text clearly mangled a symbol, saying so in `meaning`.

The old eight columns are untouched: every existing reader keeps working; lectures processed before 3 Sep render exactly as before and gain the new page the first time "Re-check" is pressed.

### 3.3 Materials (A5)

`lecture_materials` table + `server/lib/lectureMaterials.js` + `POST /lecture-materials/*`.

- PDF, plain text, Markdown; ≤ 20 MB; ≤ 12 per lecture. Same presign → browser PUT → server confirm contract as recordings, under the owner's R2 prefix, owner/purpose stamped in metadata and checked on confirm.
- Text extraction: the cheap Gemini model reads the PDF inline (the same call shape `parseTimetableUpload` uses for timetable images) and returns the text with page markers (`[Page 3]`), formulas in plain linear notation, tables row by row. No PDF library in the server; scanned slides and photographed handouts are read too (OCR is free with a multimodal model). Cost is logged under `feature = 'material_extract'`, never charged to the student. A file that yields no text is kept for download and marked `failed` so the UI can say why it is not used for verification.
- Client: `base44.materials.upload / getDownloadUrl / delete`; rows are read through `entities.LectureMaterial` (RLS, select only). Only the API writes rows, so a row can never point at an unchecked object.
- Lecture and class deletion remove the objects; data export includes the table.
- **While recording:** the island's sheet has "Attach the prof's slides". Files wait in memory and upload the moment the lecture row exists, before `processLectureRecording` is called, so the first study page is already verified. On the lecture page: drop zone + "Re-check the page against these materials", which calls `/enrich-lecture` (free; the server only runs when there is a material newer than the last pass, and not more than once every three minutes).

### 3.4 To-do (A6)

`todos` table (client-writable under the standard owner policies), `src/hooks/useTodos.js` (optimistic writes, offline queue, `cedar-data-changed`), `/todos` page (overdue / today / this week / later / undated, class filter, folded Done), per-lecture checklist on the lecture page, To-do in the nav, rail and command palette. `syncLectureTodos` inserts the pass's suggestions once per lecture (case-insensitive title dedupe) so a re-run never doubles the list.

### 3.5 The lecture page (A2, A3, A10)

`src/pages/LectureDetail.jsx` + `src/components/lecture/*`.

Top to bottom: stat strip (concepts / formulas with verified count / definitions / exam notes) → sticky jump bar with counts → Overview (one-liner, summary, "remember these") → Outline (timeline, "Listen here") → Concepts (cards: expand, difficulty, why it matters, related chips that scroll to each other, "Show in transcript", Wikipedia / YouTube / Khan Academy / Scholar) → Formulas (the expression in maths monospace with real glyphs, variables table, Verified / From-recording badge, when to use) → Definitions → Worked examples ("try it first, then show the solution") → Exam radar (high / medium / low) → Watch out & ask → To-do → Professor's materials → Transcript (search with match stepping; anchors highlight and scroll; cleanup controls) → Notes.

The page polls briefly after `status = complete` until `enriched_at` lands, with a "building the full study page" line, so the new sections fill in without a refresh.

## 4. Cost

The enrichment pass is one quality-model call with the whole transcript: a 90-minute lecture is roughly 15–20k input tokens plus materials (a slide deck is typically 3–8k), 4–8k output. At current Gemini 2.5 Flash rates that is on the order of two to three cents per lecture, within the existing per-30-minute processing charge; no new credit price was introduced. On-demand re-runs are free to the student and bounded structurally (only when materials changed, ≥ 3 min apart). Usage is logged under `feature = 'lecture_enrich'` with tokens and cost so `ownerAnalytics` sees it.

## 5. Not done yet / next

- **Timestamps, not offsets.** Anchors resolve to transcript character offsets. `lib/transcription.js` asks Groq for `response_format: json` (text only); asking for `verbose_json` and keeping the segment timestamps would let "Listen here" seek the audio player to the second. That is the single biggest next step for trust.
- **Images as materials.** PDFs are read by the model, scanned or not; a bare photo of the whiteboard (JPEG/PNG) is not accepted yet — same call, one more MIME type and a client accept entry.
- **Rendered maths.** `formulas[].latex` is stored but shown as plain text; a self-hosted KaTeX (the Worker CSP is `script-src 'self'`, so a CDN is out) would render it properly.
- **Class-level materials.** A syllabus or formula sheet applies to every lecture in a class; today it must be attached per lecture.
- **Old lectures.** The nine lectures processed before 3 Sep have no enrichment until "Re-check" is pressed; a one-off backfill job would run it for them.
- **Mobile.** `mobile/` reads the same rows; the study page components are web-only for now.
- **Handbook / exam prediction** still read the flat columns. Feeding them `ai_enrichment` (outline + exam radar) is a prompt change each.
- **Quiz option shuffling** is seeded by question text, so a retry shows the same order; fine for now, easy to randomize per attempt if that matters.
