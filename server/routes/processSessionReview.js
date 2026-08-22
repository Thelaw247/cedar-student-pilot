import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  calculateReviewScores,
  conceptsFromReview,
  normalizedConcept,
} from '../lib/reviewScores.js';

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const {
    class_id,
    lecture_ids = [],
    review_questions = [],
    self_assessment = [],
    ai_interactions = [],
    study_record_id = null,
  } = req.body || {};

  if (!class_id) return res.status(400).json({ error: 'class_id is required' });
  if (!Array.isArray(review_questions) || review_questions.length < 1 || review_questions.length > 50) {
    return res.status(400).json({ error: 'review_questions must contain 1 to 50 questions' });
  }
  if (!Array.isArray(lecture_ids) || lecture_ids.length > 100
      || !Array.isArray(self_assessment) || self_assessment.length > 100
      || !Array.isArray(ai_interactions) || ai_interactions.length > 100) {
    return res.status(400).json({ error: 'Review payload is invalid' });
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    const cls = (await client.query(
      'select id from classes where id = $1 and user_id = $2 for update',
      [class_id, userId],
    )).rows[0];
    if (!cls) {
      await client.query('rollback');
      return res.status(404).json({ error: 'Class not found' });
    }

    if (lecture_ids.length) {
      const ownedLectureCount = Number((await client.query(
        'select count(*) from lectures where id = any($1::uuid[]) and class_id = $2 and user_id = $3',
        [lecture_ids, class_id, userId],
      )).rows[0].count);
      if (ownedLectureCount !== new Set(lecture_ids).size) {
        await client.query('rollback');
        return res.status(400).json({ error: 'One or more lectures do not belong to this class' });
      }
    }

    if (study_record_id) {
      const ownedRecord = (await client.query(
        'select id from study_records where id = $1 and user_id = $2',
        [study_record_id, userId],
      )).rows[0];
      if (!ownedRecord) {
        await client.query('rollback');
        return res.status(400).json({ error: 'Study record not found' });
      }
    }

    const courseConcepts = new Set();
    const lectureRows = (await client.query(
      'select ai_concepts from lectures where class_id = $1 and user_id = $2',
      [class_id, userId],
    )).rows;
    for (const lecture of lectureRows) {
      for (const raw of (lecture.ai_concepts || [])) {
        const concept = normalizedConcept(raw);
        if (concept) courseConcepts.add(concept);
      }
    }

    const covered = new Set();
    const priorReviews = (await client.query(
      'select review_questions, self_assessment from study_session_reviews where class_id = $1 and user_id = $2',
      [class_id, userId],
    )).rows;
    for (const prior of priorReviews) {
      for (const concept of conceptsFromReview(prior.review_questions, prior.self_assessment)) covered.add(concept);
    }
    for (const concept of conceptsFromReview(review_questions, self_assessment)) covered.add(concept);
    const courseCovered = courseConcepts.size
      ? [...covered].filter((concept) => courseConcepts.has(concept)).length
      : 0;

    const scores = calculateReviewScores({
      reviewQuestions: review_questions,
      selfAssessment: self_assessment,
      totalConcepts: courseConcepts.size,
      coveredConcepts: courseCovered,
    });

    const inserted = (await client.query(
      `insert into study_session_reviews
        (user_id, study_record_id, class_id, lecture_ids, ai_interactions,
         review_questions, self_assessment, proficiency_score,
         coverage_percentage, in_depth_score, overall_score)
       values ($1, $2, $3, $4::uuid[], $5::jsonb, $6::jsonb, $7::jsonb, $8, $9, $10, $11)
       returning id`,
      [
        userId, study_record_id, class_id, lecture_ids,
        JSON.stringify(ai_interactions), JSON.stringify(review_questions),
        JSON.stringify(self_assessment), scores.proficiency_score,
        scores.coverage_percentage, scores.in_depth_score, scores.overall_score,
      ],
    )).rows[0];

    if (study_record_id) {
      await client.query(
        `update study_records
         set quiz_score = $1, quiz_questions_count = $2,
             topics_reviewed = $3::text[]
         where id = $4 and user_id = $5`,
        [scores.proficiency_score, review_questions.length, [...conceptsFromReview(review_questions, self_assessment)], study_record_id, userId],
      );
    }

    await client.query('commit');
    return res.json({
      id: inserted.id,
      ...scores,
      concepts_covered: courseCovered,
      total_concepts: courseConcepts.size,
    });
  } catch (error) {
    await client.query('rollback').catch(() => {});
    console.error('[process-session-review]', error);
    return res.status(500).json({ error: 'Could not save the completed review' });
  } finally {
    client.release();
  }
});

export default router;

