/**
 * Deleting a semester — the one exit an inactive semester has.
 *
 * Until 18 Sep 2026 no page listed semesters and nothing could delete one:
 * every timetable import created a new active semester and left the previous
 * one behind, invisible, with its classes, lectures and files still attached.
 * The only way to remove one was a raw delete, which the foreign keys cascade
 * through classes → lectures → materials and which strands every recording
 * and PDF in R2, because only the API knows to delete the objects first.
 *
 * This is the class delete in routes/deleteAcademicData.js widened to every
 * class in the semester, in the same order: collect the storage refs, delete
 * the objects, delete the row, let the cascade take the rest. One transaction,
 * under the same per-user advisory lock the import takes, so an import and a
 * delete from two tabs cannot interleave.
 *
 * If the deleted semester was the active one and others remain, the newest
 * remaining semester becomes active in the same transaction: the app reads
 * "the active semester" everywhere, and a student should never be left with
 * semesters but none of them showing.
 *
 * `deleteObjects(refs)` is injected so the transaction can be tested without
 * R2; the route passes the real deleter.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Storage refs for a lecture row: the whole-file ref plus any split parts, deduplicated. */
export function recordingRefsFor(row) {
  const refs = new Set();
  if (row?.recording_url) refs.add(row.recording_url);
  if (Array.isArray(row?.recording_parts)) {
    for (const ref of row.recording_parts) if (ref) refs.add(ref);
  }
  return [...refs];
}

export class SemesterNotFound extends Error {
  constructor() {
    super('Semester not found');
    this.name = 'SemesterNotFound';
  }
}

/**
 * @param {{query: Function}} db  a checked-out pg client
 * @param {string} userId
 * @param {string} semesterId
 * @param {{deleteObjects: (refs: string[]) => Promise<void>}} deps
 */
export async function deleteSemester(db, userId, semesterId, { deleteObjects }) {
  if (!UUID.test(String(semesterId || ''))) throw new SemesterNotFound();
  await db.query('begin');
  try {
    await db.query("set local lock_timeout = '5s'");
    await db.query("set local statement_timeout = '60s'");
    await db.query('select pg_advisory_xact_lock(hashtextextended($1::text, 0))', [userId]);

    const semester = (await db.query(
      'select id, name, is_active from semesters where id = $1 and user_id = $2 for update',
      [semesterId, userId],
    )).rows[0];
    if (!semester) throw new SemesterNotFound();

    const classIds = (await db.query(
      'select id from classes where semester_id = $1 and user_id = $2',
      [semester.id, userId],
    )).rows.map((row) => row.id);

    const lectureRows = classIds.length
      ? (await db.query(
        'select id, recording_url, recording_parts from lectures where class_id = any($1::uuid[]) and user_id = $2',
        [classIds, userId],
      )).rows
      : [];
    // By class, not by lecture: a material that belongs to the class rather
    // than to one lecture (class-level files) would otherwise be left behind.
    const materialRows = classIds.length
      ? (await db.query(
        'select storage_ref from lecture_materials where class_id = any($1::uuid[]) and user_id = $2',
        [classIds, userId],
      )).rows
      : [];

    const refs = [...new Set([
      ...lectureRows.flatMap(recordingRefsFor),
      ...materialRows.map((row) => row.storage_ref).filter(Boolean),
    ])];

    // Objects first, then the row: a row without an object is a broken link
    // the UI can show; an object without a row is storage nobody can reach.
    await deleteObjects(refs);
    await db.query('delete from semesters where id = $1 and user_id = $2', [semester.id, userId]);

    let activated = null;
    if (semester.is_active) {
      const next = (await db.query(
        'select id, name from semesters where user_id = $1 order by created_at desc, id desc limit 1',
        [userId],
      )).rows[0];
      if (next) {
        await db.query('update semesters set is_active = true where id = $1 and user_id = $2', [next.id, userId]);
        activated = { id: next.id, name: next.name };
      }
    }

    await db.query('commit');
    return {
      deleted: { id: semester.id, name: semester.name, was_active: semester.is_active },
      activated,
      counts: { classes: classIds.length, lectures: lectureRows.length, materials: materialRows.length, objects: refs.length },
    };
  } catch (error) {
    await db.query('rollback').catch(() => {});
    throw error;
  }
}
