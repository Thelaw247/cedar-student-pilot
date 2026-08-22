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

