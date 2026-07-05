import React from 'react';
import { Check, Clock, Circle, Loader2 } from 'lucide-react';

export default function ProjectRoadmap({ assignment, sessions }) {
  const roadmap = assignment?.roadmap || [];

  if (roadmap.length === 0) return null;

  // Map: stepIndex → session
  const sessionByStep = {};
  for (const s of sessions) {
    if (s.assignment_id === assignment.id && s.roadmap_step_index !== undefined && s.roadmap_step_index !== null) {
      sessionByStep[s.roadmap_step_index] = s;
    }
  }

  // Find current step (first scheduled, uncompleted)
  const currentStep = roadmap.findIndex((_, i) => {
    const s = sessionByStep[i];
    return !s || s.status === 'scheduled';
  });

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground mb-3">Project Roadmap</h3>
      <div className="space-y-0">
        {roadmap.map((rStep, i) => {
          const session = sessionByStep[i];
          const isCompleted = session?.status === 'completed';
          const isCurrent = i === currentStep && !isCompleted;
          const isUpcoming = i > currentStep && !isCompleted;
          const isExtra = i === -1; // extra sessions don't map to roadmap

          return (
            <div key={i} className="flex items-start gap-3 relative">
              {/* Vertical line */}
              {i < roadmap.length - 1 && (
                <div className="absolute left-[11px] top-7 bottom-0 w-px bg-border" />
              )}

              {/* Step indicator */}
              <div className="flex-shrink-0 mt-0.5">
                {isCompleted ? (
                  <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                  </div>
                ) : isCurrent ? (
                  <div className="w-6 h-6 rounded-full bg-primary border-2 border-primary flex items-center justify-center">
                    <Loader2 className="w-3 h-3 text-primary-foreground animate-spin" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-border bg-card flex items-center justify-center">
                    <Circle className="w-2 h-2 text-muted-foreground" fill="currentColor" />
                  </div>
                )}
              </div>

              {/* Step content */}
              <div className={`flex-1 pb-4 ${isUpcoming ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-foreground">{rStep.title}</h4>
                  {isCurrent && (
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                      Current
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{rStep.description}</p>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {rStep.estimated_minutes || 60} min</span>
                  {session && (
                    <span>{session.scheduled_date} at {session.scheduled_time}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Extra sessions (beyond roadmap) */}
      {sessions.filter(s => s.assignment_id === assignment.id && s.roadmap_step_index === -1).length > 0 && (
        <div className="mt-2 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            {sessions.filter(s => s.assignment_id === assignment.id && s.roadmap_step_index === -1).length} additional work session(s) scheduled
          </p>
        </div>
      )}
    </div>
  );
}