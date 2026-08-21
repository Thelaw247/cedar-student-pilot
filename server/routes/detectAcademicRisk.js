import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';

// Direct port of base44/functions/detectAcademicRisk/entry.ts. Pure read +
// compute, no writes, no LLM calls — not credit-gated in the original either.

const router = express.Router();
const DAY_MAP = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().split('T')[0];

router.post('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = daysAgo(7);
    const fourteenDaysAgo = daysAgo(14);

    const { rows: semesters } = await pool.query('select * from semesters where user_id = $1 and is_active = true', [userId]);
    if (semesters.length === 0) return res.json({ risks: [], burnout_level: 'none' });

    const { rows: classes } = await pool.query('select * from classes where semester_id = $1 and user_id = $2', [semesters[0].id, userId]);
    let allLectures = [], allAssignments = [], allSessions = [];
    for (const cls of classes) {
      allLectures.push(...(await pool.query('select * from lectures where class_id = $1 and user_id = $2 order by date desc', [cls.id, userId])).rows);
      allAssignments.push(...(await pool.query('select * from assignments where class_id = $1 and user_id = $2', [cls.id, userId])).rows);
      allSessions.push(...(await pool.query('select * from study_sessions where class_id = $1 and user_id = $2', [cls.id, userId])).rows);
    }
    const allStudyRecords = (await pool.query('select * from study_records where user_id = $1', [userId])).rows;
    const allReviews = (await pool.query('select * from study_session_reviews where user_id = $1', [userId])).rows;

    const risks = [];
    let burnoutScore = 0;
    const ds = (d) => (d instanceof Date ? d.toISOString().split('T')[0] : d);

    const missedLectures = allLectures.filter((l) => l.is_missed);
    if (missedLectures.length > 0) {
      risks.push({ type: 'missed_lectures', severity: missedLectures.length > 3 ? 'high' : 'medium', title: `${missedLectures.length} missed lecture${missedLectures.length !== 1 ? 's' : ''}`, description: 'You have missed lectures that may contain exam-relevant content. Consider generating AI summaries for these.', action: 'Generate missed lecture summaries from your class study tools.' });
      burnoutScore += missedLectures.length * 2;
    }

    const recentStudyRecords = allStudyRecords.filter((r) => ds(r.date) >= sevenDaysAgo);
    const totalStudyMinutes = recentStudyRecords.reduce((sum, r) => sum + Math.floor((r.duration_seconds || 0) / 60), 0);
    if (totalStudyMinutes < 60 && allAssignments.length > 0) {
      risks.push({ type: 'low_engagement', severity: 'high', title: 'Low study engagement this week', description: `You've only studied ${totalStudyMinutes} minutes in the last 7 days. You have ${allAssignments.length} assignments coming up.`, action: 'Schedule a study session to catch up.' });
      burnoutScore += 3;
    }

    const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const upcomingDeadlines = allAssignments.filter((a) => ds(a.due_date) >= today && ds(a.due_date) <= weekAhead).sort((a, b) => ds(a.due_date).localeCompare(ds(b.due_date)));
    if (upcomingDeadlines.length > 0) {
      const scheduled = allSessions.filter((s) => s.status === 'scheduled' && ds(s.scheduled_date) >= today);
      if (scheduled.length === 0) {
        risks.push({ type: 'no_study_planned', severity: 'medium', title: `${upcomingDeadlines.length} upcoming deadline${upcomingDeadlines.length !== 1 ? 's' : ''} with no study sessions`, description: `You have "${upcomingDeadlines[0].title}" due ${ds(upcomingDeadlines[0].due_date)} but no study sessions scheduled.`, action: 'Generate a study plan from your assignments.' });
        burnoutScore += 2;
      }
    }

    const recentReviews = allReviews.filter((r) => r.proficiency_score !== null && r.proficiency_score !== undefined);
    if (recentReviews.length > 0) {
      const avgProficiency = recentReviews.reduce((sum, r) => sum + (r.proficiency_score || 0), 0) / recentReviews.length;
      if (avgProficiency < 50) {
        risks.push({ type: 'low_proficiency', severity: 'high', title: `Low quiz performance (${Math.round(avgProficiency)}% avg)`, description: 'Your recent review scores suggest gaps in understanding. The system will increase review frequency for these topics.', action: 'Review the lectures associated with your lowest-scoring topics.' });
        burnoutScore += 3;
      }
    }

    const behindSessions = allSessions.filter((s) => s.status === 'scheduled' && ds(s.scheduled_date) < today);
    if (behindSessions.length > 2) {
      risks.push({ type: 'behind_schedule', severity: 'medium', title: `${behindSessions.length} missed study sessions`, description: 'You have multiple study sessions that were scheduled but not completed. Consider recalculating your plan.', action: 'Use the "Recalculate" button on your home page to reschedule.' });
      burnoutScore += 2;
    }

    const threeDaysAgo = daysAgo(3);
    const last3DaysMinutes = allStudyRecords.filter((r) => ds(r.date) >= threeDaysAgo).reduce((sum, r) => sum + Math.floor((r.duration_seconds || 0) / 60), 0);
    if (last3DaysMinutes > 300) burnoutScore += 4;

    const studyFrequency = allStudyRecords.filter((r) => ds(r.date) >= fourteenDaysAgo).length;
    if (studyFrequency > 14) burnoutScore += 3;

    const todayLabel = DAY_MAP[new Date().getDay()];
    const todayClasses = classes.filter((c) => (c.days_of_week || []).includes(todayLabel));
    if (todayClasses.length > 4) burnoutScore += 2;

    let burnoutLevel = 'none', burnoutAdvice = '';
    if (burnoutScore >= 12) { burnoutLevel = 'high'; burnoutAdvice = 'You are showing signs of high study load. Consider taking a rest day and reducing study intensity.'; }
    else if (burnoutScore >= 7) { burnoutLevel = 'moderate'; burnoutAdvice = 'Your study load is moderate. Make sure to take regular breaks and maintain sleep schedule.'; }
    else if (burnoutScore >= 3) { burnoutLevel = 'low'; burnoutAdvice = 'You are managing well. Keep up consistent study habits.'; }

    res.json({
      risks, burnout_level: burnoutLevel, burnout_score: burnoutScore, burnout_advice: burnoutAdvice,
      stats: { total_study_minutes_week: totalStudyMinutes, upcoming_deadlines: upcomingDeadlines.length, missed_lectures: missedLectures.length, study_sessions_behind: behindSessions.length },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
