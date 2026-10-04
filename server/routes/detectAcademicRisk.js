import express from 'express';
import { pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getClassMeetingsForDate } from '../../src/lib/classSchedule.js';
import { sendServerError } from '../lib/http.js';

// Direct port of base44/functions/detectAcademicRisk/entry.ts. Pure read +
// compute, no writes, no LLM calls — not credit-gated in the original either.

const router = express.Router();
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
    // "Oct 9": these sentences are read on the Today page, not in a log.
    const shortDate = (d) => new Date(`${ds(d)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const missedLectures = allLectures.filter((l) => l.is_missed);
    if (missedLectures.length > 0) {
      risks.push({ type: 'missed_lectures', severity: missedLectures.length > 3 ? 'high' : 'medium', title: `${missedLectures.length} missed lecture${missedLectures.length !== 1 ? 's' : ''}`, description: `${missedLectures.length === 1 ? 'It' : 'They'} may have covered things that come up on the exam. Each class page can write up an estimate of what you missed.`, action: 'Open the class and ask for a summary of what you missed.' });
      burnoutScore += missedLectures.length * 2;
    }

    const recentStudyRecords = allStudyRecords.filter((r) => ds(r.date) >= sevenDaysAgo);
    const totalStudyMinutes = recentStudyRecords.reduce((sum, r) => sum + Math.floor((r.duration_seconds || 0) / 60), 0);
    if (totalStudyMinutes < 60 && allAssignments.length > 0) {
      risks.push({ type: 'low_engagement', severity: 'high', title: 'Not much study time this week', description: `About ${totalStudyMinutes} minutes in the last 7 days, with ${allAssignments.length} deadline${allAssignments.length !== 1 ? 's' : ''} coming up.`, action: 'Book a study session.' });
      burnoutScore += 3;
    }

    const weekAhead = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const upcomingDeadlines = allAssignments.filter((a) => ds(a.due_date) >= today && ds(a.due_date) <= weekAhead).sort((a, b) => ds(a.due_date).localeCompare(ds(b.due_date)));
    if (upcomingDeadlines.length > 0) {
      const scheduled = allSessions.filter((s) => s.status === 'scheduled' && ds(s.scheduled_date) >= today);
      if (scheduled.length === 0) {
        risks.push({ type: 'no_study_planned', severity: 'medium', title: `${upcomingDeadlines.length} deadline${upcomingDeadlines.length !== 1 ? 's' : ''} this week with nothing booked`, description: `"${upcomingDeadlines[0].title}" is due ${shortDate(upcomingDeadlines[0].due_date)} and no study sessions are scheduled yet.`, action: 'Make a study plan from your deadlines.' });
        burnoutScore += 2;
      }
    }

    const recentReviews = allReviews.filter((r) => r.proficiency_score !== null && r.proficiency_score !== undefined);
    if (recentReviews.length > 0) {
      const avgProficiency = recentReviews.reduce((sum, r) => sum + (r.proficiency_score || 0), 0) / recentReviews.length;
      if (avgProficiency < 50) {
        risks.push({ type: 'low_proficiency', severity: 'high', title: `Quiz scores are low (${Math.round(avgProficiency)}% on average)`, description: 'Your recent review scores point to a few gaps. Going back over those lectures is the quickest fix.', action: 'Review the lectures behind your lowest scores.' });
        burnoutScore += 3;
      }
    }

    const behindSessions = allSessions.filter((s) => s.status === 'scheduled' && ds(s.scheduled_date) < today);
    if (behindSessions.length > 2) {
      risks.push({ type: 'behind_schedule', severity: 'medium', title: `${behindSessions.length} study sessions missed`, description: 'They were booked but never happened. Rebooking them from the study page gets the plan back on track.', action: 'Rebook them from the study page.' });
      burnoutScore += 2;
    }

    const threeDaysAgo = daysAgo(3);
    const last3DaysMinutes = allStudyRecords.filter((r) => ds(r.date) >= threeDaysAgo).reduce((sum, r) => sum + Math.floor((r.duration_seconds || 0) / 60), 0);
    if (last3DaysMinutes > 300) burnoutScore += 4;

    const studyFrequency = allStudyRecords.filter((r) => ds(r.date) >= fourteenDaysAgo).length;
    if (studyFrequency > 14) burnoutScore += 3;

    const todayMeetingCount = classes.reduce((count, cls) => count + getClassMeetingsForDate(cls, today).length, 0);
    if (todayMeetingCount > 4) burnoutScore += 2;

    let burnoutLevel = 'none', burnoutAdvice = '';
    if (burnoutScore >= 12) { burnoutLevel = 'high'; burnoutAdvice = 'That is a heavy study load. A rest day, and shorter sessions after it, will do more for you than pushing on.'; }
    else if (burnoutScore >= 7) { burnoutLevel = 'moderate'; burnoutAdvice = 'A steady load. Keep taking breaks and protect your sleep.'; }
    else if (burnoutScore >= 3) { burnoutLevel = 'low'; burnoutAdvice = 'You are managing well. Keep the routine going.'; }

    res.json({
      risks, burnout_level: burnoutLevel, burnout_score: burnoutScore, burnout_advice: burnoutAdvice,
      stats: { total_study_minutes_week: totalStudyMinutes, upcoming_deadlines: upcomingDeadlines.length, missed_lectures: missedLectures.length, study_sessions_behind: behindSessions.length },
    });
  } catch (error) {
    sendServerError(res, error, 'academic-risk');
  }
});

export default router;
