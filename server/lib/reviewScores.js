function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

export function normalizedConcept(value) {
  return String(value || '').trim().toLowerCase();
}

export function conceptsFromReview(reviewQuestions = [], selfAssessment = []) {
  const concepts = new Set();
  for (const question of reviewQuestions) {
    const concept = normalizedConcept(question?.concept);
    if (concept) concepts.add(concept);
  }
  for (const item of selfAssessment) {
    if (item?.covered === false) continue;
    const concept = normalizedConcept(item?.concept || item?.topic);
    if (concept) concepts.add(concept);
  }
  return concepts;
}

export function calculateReviewScores({
  reviewQuestions = [],
  selfAssessment = [],
  totalConcepts = 0,
  coveredConcepts = 0,
}) {
  const answered = reviewQuestions.length;
  const correct = reviewQuestions.filter((question) => question?.is_correct === true).length;
  const proficiencyScore = answered ? clampPercent((correct / answered) * 100) : 0;

  const coveredRatings = selfAssessment
    .filter((item) => item?.covered !== false)
    .map((item) => clampPercent(item?.proficiency));
  const inDepthScore = coveredRatings.length
    ? clampPercent(coveredRatings.reduce((sum, value) => sum + value, 0) / coveredRatings.length)
    : proficiencyScore;

  const coveragePercentage = totalConcepts
    ? clampPercent((coveredConcepts / totalConcepts) * 100)
    : 0;
  const overallScore = clampPercent(
    (proficiencyScore * 0.6) + (inDepthScore * 0.25) + (coveragePercentage * 0.15),
  );

  return {
    proficiency_score: proficiencyScore,
    coverage_percentage: coveragePercentage,
    in_depth_score: inDepthScore,
    overall_score: overallScore,
    correct_count: correct,
  };
}


/**
 * The same review, read as evidence about concepts rather than as a score.
 *
 * `conceptsFromReview` above lowercases, because it exists to intersect a
 * review against `lectures.ai_concepts` and case must not decide whether two
 * concepts are the same one. Coverage is different: `concepts_seen` is
 * rendered as chips a student reads, and the two writers that already fill it
 * store the concept exactly as the lecture wrote it. So this keeps the
 * original spelling, and only folds case for deciding what is a duplicate --
 * first spelling wins.
 *
 * Mastery is quiz-derived and stays that way: a concept counts as mastered
 * only when every question asked about it was answered correctly. A
 * self-assessment says a topic was covered, never that it was mastered --
 * a slider a student drags is not a demonstration.
 *
 * @returns {{seen: string[], mastered: string[]}} in display form
 */
export function masteryFromReview(reviewQuestions = [], selfAssessment = []) {
  const display = new Map();   // normalized -> first spelling seen
  const results = new Map();   // normalized -> { correct, total }

  const remember = (raw) => {
    const key = normalizedConcept(raw);
    if (!key) return null;
    if (!display.has(key)) display.set(key, String(raw).trim());
    return key;
  };

  for (const question of reviewQuestions) {
    const key = remember(question?.concept);
    if (!key) continue;
    const tally = results.get(key) || { correct: 0, total: 0 };
    tally.total += 1;
    if (question?.is_correct === true) tally.correct += 1;
    results.set(key, tally);
  }

  for (const item of selfAssessment) {
    if (item?.covered === false) continue;
    remember(item?.concept || item?.topic);
  }

  const seen = [...display.values()];
  const mastered = [...results.entries()]
    .filter(([, tally]) => tally.total > 0 && tally.correct === tally.total)
    .map(([key]) => display.get(key));

  return { seen, mastered };
}
