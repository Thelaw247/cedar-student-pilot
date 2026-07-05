import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, X, ArrowRight, ArrowLeft, Check, Sparkles, Clock, ListChecks } from 'lucide-react';

export default function ProjectAssignmentModal({ classId, className, onClose }) {
  const [step, setStep] = useState('form'); // form → fields → roadmap → done
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState([]);
  const [fieldValues, setFieldValues] = useState({});
  const [roadmap, setRoadmap] = useState([]);
  const [loadingFields, setLoadingFields] = useState(false);
  const [loadingRoadmap, setLoadingRoadmap] = useState(false);
  const [creating, setCreating] = useState(false);

  const analyzeProject = async () => {
    setLoadingFields(true);
    try {
      const res = await base44.functions.invoke('generateProjectRoadmap', {
        description,
        class_name: className,
      });
      if (res.data?.error) throw new Error(res.data.error);
      setFields(res.data.fields || []);
      setStep('fields');
    } catch (e) {
      alert('Could not analyze project. Please try again.');
    }
    setLoadingFields(false);
  };

  const generateRoadmap = async () => {
    setLoadingRoadmap(true);
    try {
      const res = await base44.functions.invoke('generateProjectRoadmap', {
        description,
        project_metadata: fieldValues,
        class_name: className,
        due_date: dueDate,
      });
      if (res.data?.error) throw new Error(res.data.error);
      setRoadmap(res.data.roadmap || []);
      setStep('roadmap');
    } catch (e) {
      alert('Could not generate roadmap. Please try again.');
    }
    setLoadingRoadmap(false);
  };

  const createProject = async () => {
    setCreating(true);
    try {
      const assignment = await base44.entities.Assignment.create({
        class_id: classId,
        title,
        due_date: dueDate,
        type: 'project',
        description,
        project_metadata: fieldValues,
        roadmap,
      });

      // Create project sessions from roadmap, distributed from today to due date
      const today = new Date();
      const due = new Date(dueDate + 'T23:59:59');
      const totalDays = Math.max(1, Math.ceil((due - today) / (1000 * 60 * 60 * 24)));
      const stepCount = roadmap.length;

      const sessionsToCreate = roadmap.map((rStep, i) => {
        const dayOffset = Math.round((totalDays / (stepCount + 1)) * (i + 1));
        const d = new Date(today);
        d.setDate(d.getDate() + Math.min(dayOffset, totalDays));
        return {
          assignment_id: assignment.id,
          class_id: classId,
          scheduled_date: d.toISOString().split('T')[0],
          scheduled_time: '15:00',
          duration_minutes: rStep.estimated_minutes || 60,
          priority: i >= stepCount - 2 ? 'high' : 'medium',
          status: 'scheduled',
          session_type: 'project',
          roadmap_step_index: i,
          notes: `Project Step ${i + 1}: ${rStep.title}`,
        };
      });

      if (sessionsToCreate.length > 0) {
        await base44.entities.StudySession.bulkCreate(sessionsToCreate);
      }

      setStep('done');
      setTimeout(() => onClose(), 2000);
    } catch (e) {
      alert('Could not create project. Please try again.');
    }
    setCreating(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 glass" onClick={onClose}>
      <div className="bg-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-border p-6 animate-fade-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-lg font-semibold">
            {step === 'form' ? 'New Project' : step === 'fields' ? 'Project Details' : step === 'roadmap' ? 'Your Roadmap' : 'Project Created!'}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        {/* Step 1: Basic form */}
        {step === 'form' && (
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Project Title</p>
              <input type="text" placeholder="e.g. Renewable Energy Presentation" value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" autoFocus />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Due Date</p>
              <input type="date" value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">What do you need to create?</p>
              <textarea placeholder="e.g. Create a Google Slides presentation about renewable energy sources, or build a projectile motion simulator in Python" value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none" rows={4} />
              <p className="text-[10px] text-muted-foreground mt-1">The AI will determine what additional info is needed based on your description.</p>
            </div>
            <button onClick={analyzeProject} disabled={loadingFields || !title || !dueDate || !description}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
              {loadingFields ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</> : <>Analyze Project <ArrowRight className="w-4 h-4" /></>}
            </button>
          </div>
        )}

        {/* Step 2: AI-determined fields */}
        {step === 'fields' && (
          <div className="space-y-3">
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">The AI determined these fields are needed for your project. Fill them in to generate a step-by-step roadmap.</p>
            </div>
            {fields.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No additional fields needed. Generate your roadmap directly.</p>
            ) : (
              fields.map(f => (
                <div key={f.key}>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">
                    {f.label}{f.required && <span className="text-destructive"> *</span>}
                  </p>
                  {f.type === 'choice' ? (
                    <select value={fieldValues[f.key] || ''}
                      onChange={e => setFieldValues({ ...fieldValues, [f.key]: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40">
                      <option value="">Select...</option>
                      {(f.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type={f.type === 'number' ? 'number' : 'text'}
                      value={fieldValues[f.key] || ''}
                      onChange={e => setFieldValues({ ...fieldValues, [f.key]: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                  )}
                </div>
              ))
            )}
            <div className="flex gap-2 pt-2">
              <button onClick={() => setStep('form')}
                className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={generateRoadmap} disabled={loadingRoadmap}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {loadingRoadmap ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating Roadmap...</> : <>Generate Roadmap <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Roadmap preview */}
        {step === 'roadmap' && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Here's your project roadmap. {roadmap.length} work sessions will be scheduled before {dueDate}.</p>
            <div className="space-y-2">
              {roadmap.map((rStep, i) => (
                <div key={i} className="rounded-lg border border-border p-3 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-foreground">{rStep.title}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{rStep.description}</p>
                    <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {rStep.estimated_minutes || 60} min
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setStep('fields')}
                className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted flex items-center gap-1">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={createProject} disabled={creating}
                className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
                {creating ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</> : <><ListChecks className="w-4 h-4" /> Create Project & Schedule</>}
              </button>
            </div>
          </div>
        )}

        {/* Done */}
        {step === 'done' && (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
              <Check className="w-7 h-7 text-emerald-600" />
            </div>
            <h3 className="font-heading text-lg font-semibold mb-1">Project Created!</h3>
            <p className="text-sm text-muted-foreground">{roadmap.length} work sessions scheduled before {dueDate}.</p>
          </div>
        )}
      </div>
    </div>
  );
}