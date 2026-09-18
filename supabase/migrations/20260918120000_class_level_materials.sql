-- A professor's file can belong to the course, not only to one lecture.
--
-- lecture_materials was built for "the slides for THIS lecture": every row
-- had to name a lecture, and the class_id beside it was a convenience. But
-- the syllabus, a formula sheet, a past exam, the textbook chapter — the
-- files a student most wants questions generated from — belong to the
-- course. Until now the only way to attach one was to pick a lecture to hang
-- it on, and a student with no recordings yet had nowhere to put it at all.
--
-- One constraint loosens: lecture_id may be null, meaning "this class, no
-- particular lecture". class_id stays NOT NULL, so every file still cascades
-- with its class, and the delete routes already collect storage refs by
-- class (routes/deleteAcademicData.js, lib/semesterDelete.js), so a
-- class-level file is removed from R2 with everything else.
--
-- Nothing else changes: RLS (select own rows by user_id) does not read
-- lecture_id; the API is still the only writer; the lecture page's own
-- materials list and the enrichment pass still filter by lecture_id and
-- therefore never see a class-level file unless a later change opts them in.
-- Every existing row keeps its lecture_id. Reversible with `set not null`
-- once class-level rows are removed.

alter table public.lecture_materials
  alter column lecture_id drop not null;

comment on column public.lecture_materials.lecture_id is
  'The lecture this file was attached to, or null for a file attached to the class itself (syllabus, formula sheet, past exam). class_id is always set.';

comment on table public.lecture_materials is
  'Professor-supplied files (slides, handouts, problem sets, syllabus) attached to a lecture or, with lecture_id null, to the class. The API uploads, extracts text and deletes; the enrichment pass reads a lecture''s own files as the source of truth for formulas and definitions; the study-material generator can read any file of the class.';
