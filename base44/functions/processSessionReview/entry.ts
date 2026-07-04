import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      class_id,
      lecture_ids,
      review_questions,
      self_assessment,
      ai_interactions,
      study_record_id
    } = body;

    if (!class_id) return Response.json({ error: 'class_id is required' }, { status: 400 });

    // --- Calculate proficiency from review questions ---
    const answeredQuestions = (review_questions || []).filter(q => q.user_answer);
    const correctCount = answeredQuestions.filter(q => q.is_correct).length;
    const proficiencyScore = answeredQuestions.length > 0
      ? Math.round((correctCount / answeredQuestions.length) * 100)
      : 0;

    // --- Calculate coverage percentage ---
    // Get all lectures for the class to know total concepts
    const allLectures = await base44.asServiceRole.entities.Lecture.filter({ class_id });
    const lecturesWithContent = allLectures.filter(l => l.ai_concepts && l.ai_concepts.length > 0);
    const totalConcepts = [...new Set(lecturesWithContent.flatMap(l => l.ai_concepts || []))];

    // Concepts covered in this session
    const sessionConcepts = [
      ...(review_questions || []).map(q => q.concept).filter(Boolean),
      ...self_assessment.map(s => s.concept).filter(Boolean)
    ];
    const uniqueSessionConcepts = [...new Set(sessionConcepts)];

    // Get existing knowledge coverage for this class
    const existingCoverage = await base44.asServiceRole.entities.KnowledgeCoverage.filter({ class_id });
    const previouslySeen = existingCoverage.flatMap(k => k.concepts_seen || []);
    const allSeenConcepts = [...new Set([...previouslySeen, ...uniqueSessionConcepts])];

    const coveragePercentage = totalConcepts.length > 0
      ? Math.round((allSeenConcepts.length / totalConcepts.length) * 100)
      : 0;

    // --- Calculate in-depth score ---
    // Based on: answer correctness + AI interactions + self-assessment proficiency
    const selfAssessmentAvg = self_assessment.length > 0
      ? self_assessment.reduce((sum, s) => sum + (s.proficiency || 0), 0) / self_assessment.length
      : 0;
    const aiEngagementScore = ai_interactions && ai_interactions.length > 0
      ? Math.min(100, ai_interactions.length * 15)
      : 0;

    const inDepthScore = Math.round(
      proficiencyScore * 0.5 + selfAssessmentAvg * 0.3 + aiEngagementScore * 0.2
    );

    const overallScore = Math.round(
      proficiencyScore * 0.4 + coveragePercentage * 0.2 + inDepthScore * 0.4
    );

    // --- Save the review record ---
    const review = await base44.asServiceRole.entities.StudySessionReview.create({
      study_record_id: study_record_id || null,
      class_id,
      lecture_ids: lecture_ids || [],
      ai_interactions: ai_interactions || [],
      review_questions: review_questions || [],
      self_assessment: self_assessment || [],
      proficiency_score: proficiencyScore,
      coverage_percentage: coveragePercentage,
      in_depth_score: inDepthScore,
      overall_score: overallScore
    });

    // --- Update KnowledgeCoverage per lecture ---
    const today = new Date().toISOString().split('T')[0];

    // Group concepts by lecture
    const lectureConceptMap = {};
    for (const lec of lecturesWithContent) {
      for (const concept of (lec.ai_concepts || [])) {
        if (uniqueSessionConcepts.includes(concept)) {
          if (!lectureConceptMap[lec.id]) lectureConceptMap[lec.id] = [];
          lectureConceptMap[lec.id].push(concept);
        }
      }
    }

    for (const [lecId, concepts] of Object.entries(lectureConceptMap)) {
      const existing = existingCoverage.find(k => k.lecture_id === lecId);
      // Determine mastered concepts (correctly answered or self-assessed as proficient >= 70)
      const masteredFromQuiz = (review_questions || [])
        .filter(q => q.is_correct && q.concept && concepts.includes(q.concept))
        .map(q => q.concept);
      const masteredFromSelf = (self_assessment || [])
        .filter(s => s.proficiency >= 70 && s.covered && s.concept && concepts.includes(s.concept))
        .map(s => s.concept);

      if (existing) {
        const updatedSeen = [...new Set([...(existing.concepts_seen || []), ...concepts])];
        const updatedMastered = [...new Set([...(existing.concepts_mastered || []), ...masteredFromQuiz, ...masteredFromSelf])];
        const newProficiency = updatedSeen.length > 0
          ? Math.round((updatedMastered.length / updatedSeen.length) * 100)
          : 0;

        await base44.asServiceRole.entities.KnowledgeCoverage.update(existing.id, {
          concepts_seen: updatedSeen,
          concepts_mastered: updatedMastered,
          proficiency: Math.max(existing.proficiency || 0, newProficiency),
          sessions_reviewed: (existing.sessions_reviewed || 0) + 1,
          last_reviewed_date: today
        });
      } else {
        const mastered = [...new Set([...masteredFromQuiz, ...masteredFromSelf])];
        await base44.asServiceRole.entities.KnowledgeCoverage.create({
          class_id,
          lecture_id: lecId,
          concepts_seen: concepts,
          concepts_mastered: mastered,
          proficiency: concepts.length > 0 ? Math.round((mastered.length / concepts.length) * 100) : 0,
          sessions_reviewed: 1,
          last_reviewed_date: today
        });
      }
    }

    // --- Calculate course-wide coverage from all KnowledgeCoverage records ---
    const updatedCoverage = await base44.asServiceRole.entities.KnowledgeCoverage.filter({ class_id });
    const totalSeen = [...new Set(updatedCoverage.flatMap(k => k.concepts_seen || []))];
    const totalMastered = [...new Set(updatedCoverage.flatMap(k => k.concepts_mastered || []))];
    const courseProficiency = totalSeen.length > 0
      ? Math.round((totalMastered.length / totalSeen.length) * 100)
      : 0;

    return Response.json({
      review_id: review.id,
      proficiency_score: proficiencyScore,
      coverage_percentage: coveragePercentage,
      in_depth_score: inDepthScore,
      overall_score: overallScore,
      concepts_covered: allSeenConcepts.length,
      total_concepts: totalConcepts.length,
      course_proficiency: courseProficiency,
      course_coverage: totalConcepts.length > 0 ? Math.round((totalSeen.length / totalConcepts.length) * 100) : 0
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});