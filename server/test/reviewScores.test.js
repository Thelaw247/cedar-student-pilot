import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateReviewScores, conceptsFromReview } from '../lib/reviewScores.js';

test('calculates bounded deterministic review scores', () => {
  assert.deepEqual(calculateReviewScores({
    reviewQuestions: [{ is_correct: true }, { is_correct: false }],
    selfAssessment: [{ covered: true, proficiency: 80 }],
    totalConcepts: 4,
    coveredConcepts: 2,
  }), {
    proficiency_score: 50,
    coverage_percentage: 50,
    in_depth_score: 80,
    overall_score: 58,
    correct_count: 1,
  });
});

test('normalizes and deduplicates covered concepts', () => {
  assert.deepEqual(
    [...conceptsFromReview(
      [{ concept: ' Calculus ' }, { concept: 'calculus' }],
      [{ concept: 'Vectors', covered: true }, { concept: 'Ignored', covered: false }],
    )],
    ['calculus', 'vectors'],
  );
});

