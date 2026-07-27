import React from 'react';
import { useParams } from 'react-router-dom';
import PracticePanel from '@/components/PracticePanel';
import ReviewFromLectures from '@/components/ReviewFromLectures';

// Thin wrapper kept so the /study-tools route keeps working during the Study-tab
// migration. Its content now lives in reusable components used by the Study tab.
export default function StudyTools() {
  const { classId } = useParams();
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
      <div className="mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold">Practice</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Turn your lectures into flashcards, quizzes, and practice tests</p>
      </div>

      <div className="mb-8">
        <h2 className="font-heading text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Review from Lectures</h2>
        <ReviewFromLectures />
      </div>

      <PracticePanel initialClassId={classId || ''} />
    </div>
  );
}
