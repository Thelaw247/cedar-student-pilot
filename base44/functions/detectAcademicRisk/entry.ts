import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Gather data across all classes
    const semesters = await base44.entities.Semester.filter({ is_active: true });
    if (semesters.length === 0) {
      return Response.json({ risks: [], burnout_level: 'none' });
    }

    const classes = await base44.entities.Class.filter({ semester_id: semesters[0].id });
    const allLectures = [];
    const allAssignments = [];
    const allStudyRecords = [];
    const allReviews = [];
    const allSessions = [];

    for (const cls of classes) {
      const lecs = await base44.entities.Lecture.filter({ class_id: cls.id }, '-date');
      allLectures.push(...lecs);
      const asgns = await base44.entities.Assignment.filter({ class_id: cls.id });
      allAssignments.push(...asgns);
      const sessions = await base44.entities.StudySession.filter({ class_id: cls.id });
      allSessions.push(...sessions);
    }

    const studyRecords = await base44.entities.StudyRecord.list();
    allStudyRecords.push(...studyRecords);
    const reviews = await base44.entities.StudySessionReview.list();
    allReviews.push(...reviews);

    const risks = [];
    let burnoutScore = 0;

    // 1. Missed lectures risk
    const missedLectures = allLectures.filter(l => l.is_missed);
    if (missedLectures.length > 0) {
      risks.push({
        type: 'missed_lectures',
        severity: missedLectures.length > 3 ? 'high' : 'medium',
        title: `${missedLectures.length} missed lecture${missedLectures.length !== 1 ? 's' : ''}`,
        description: 'You have missed lectures that may contain exam-relevant content. Consider generating AI summaries for these.',
        action: 'Generate missed lecture summaries from your class study tools.',
      });
      burnoutScore += missedLectures.length * 2;
    }

    // 2. Low study engagement
    const recentStudyRecords = allStudyRecords.filter(r => r.date >= sevenDaysAgo);
    const totalStudyMinutes = recentStudyRecords.reduce((sum, r) => sum + Math.floor((r.duration_seconds || 0) / 60), 0);
    if (totalStudyMinutes < 60 && allAssignments.length > 0) {
      risks.push({
        type: 'low_engagement',
        severity: 'high',
        title: 'Low study engagement this week',
        description: `You've only studied ${totalStudyMinutes} minutes in the last 7 days. You have ${allAssignments.length} assignments coming up.`,
        action: 'Schedule a study session to catch up.',
      });
      burnoutScore += 3;
    }

    // 3. Upcoming deadline risk
    const upcomingDeadlines = allAssignments
      .filter(a => a.due_date >= today && a.due_date <= new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0])
      .sort((a, b) => a.due_date.localeCompare(b.due_date));
    if (upcomingDeadlines.length > 0) {
      const studySessionsScheduled = allSessions.filter(s => s.status === 'scheduled' && s.scheduled_date >= today);
      if (studySessionsScheduled.length === 0) {
        risks.push({
          type: 'no_study_planned',
          severity: 'medium',
          title: `${upcomingDeadlines.length} upcoming deadline${upcomingDeadlines.length !== 1 ? 's' : ''} with no study sessions`,
          description: `You have "${upcomingDeadlines[0].title}" due ${upcomingDeadlines[0].due_date} but no study sessions scheduled.`,
          action: 'Generate a study plan from your assignments.',
        });
        burnoutScore += 2;
      }
    }

    // 4. Poor quiz performance
    const recentReviews = allReviews.filter(r => r.proficiency_score !== null && r.proficiency_score !== undefined);
    if (recentReviews.length > 0) {
      const avgProficiency = recentReviews.reduce((sum, r) => sum + (r.proficiency_score || 0), 0) / recentReviews.length;
      if (avgProficiency < 50) {
        risks.push({
          type: 'low_proficiency',
          severity: 'high',
          title: `Low quiz performance (${Math.round(avgProficiency)}% avg)`,
          description: 'Your recent review scores suggest gaps in understanding. The system will increase review frequency for these topics.',
          action: 'Review the lectures associated with your lowest-scoring topics.',
        });
        burnoutScore += 3;
      }
    }

    // 5. Behind schedule
    const behindSessions = allSessions.filter(s => s.status === 'scheduled' && s.scheduled_date < today);
    if (behindSessions.length > 2) {
      risks.push({
        type: 'behind_schedule',
        severity: 'medium',
        title: `${behindSessions.length} missed study sessions`,
        description: 'You have multiple study sessions that were scheduled but not completed. Consider recalculating your plan.',
        action: 'Use the "Recalculate" button on your home page to reschedule.',
      });
      burnoutScore += 2;
    }

    // Burnout detection
    // Check study density (high study time in short period)
    const last3DaysRecords = allStudyRecords.filter(r => r.date >= new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0]);
    const last3DaysMinutes = last3DaysRecords.reduce((sum, r) => sum + Math.floor((r.duration_seconds || 0) / 60), 0);
    if (last3DaysMinutes > 300) {
      burnoutScore += 4;
    }

    // Check for late-night study patterns
    const lateNightRecords = allStudyRecords.filter(r => {
      if (!r.date) return false;
      return true; // Can't determine time of day from record, but high frequency is a proxy
    });
    const studyFrequency = allStudyRecords.filter(r => r.date >= fourteenDaysAgo).length;
    if (studyFrequency > 14) {
      burnoutScore += 3;
    }

    // Check schedule density
    const todayClasses = classes.filter(c => {
      const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return (c.days_of_week || []).includes(dayMap[new Date().getDay()]);
    });
    if (todayClasses.length > 4) {
      burnoutScore += 2;
    }

    let burnoutLevel = 'none';
    let burnoutAdvice = '';
    if (burnoutScore >= 12) {
      burnoutLevel = 'high';
      burnoutAdvice = 'You are showing signs of high study load. Consider taking a rest day and reducing study intensity.';
    } else if (burnoutScore >= 7) {
      burnoutLevel = 'moderate';
      burnoutAdvice = 'Your study load is moderate. Make sure to take regular breaks and maintain sleep schedule.';
    } else if (burnoutScore >= 3) {
      burnoutLevel = 'low';
      burnoutAdvice = 'You are managing well. Keep up consistent study habits.';
    }

    return Response.json({
      risks,
      burnout_level: burnoutLevel,
      burnout_score: burnoutScore,
      burnout_advice: burnoutAdvice,
      stats: {
        total_study_minutes_week: totalStudyMinutes,
        upcoming_deadlines: upcomingDeadlines.length,
        missed_lectures: missedLectures.length,
        study_sessions_behind: behindSessions.length,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});