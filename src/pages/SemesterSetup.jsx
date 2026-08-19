import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getInitials, getAvatarColor } from '@/lib/avatar';
import { Upload, FileText, Loader2, Check, X, Plus, ChevronRight, Camera, AlertCircle } from 'lucide-react';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export default function SemesterSetup() {
  const { user, checkUserAuth } = useAuth();
  // Step 0 (name + optional photo) only shows for someone who has never set a
  // name — i.e. genuinely the first time through. Nothing else in the app
  // captures a name at signup (Register.jsx is email/password only), so this
  // is the only place it's ever asked. An existing user setting up a SECOND
  // semester already has a name and skips straight to step 1, unchanged from
  // before this feature existed.
  const [step, setStep] = useState(() => (user?.full_name ? 1 : 0));
  const [welcomeName, setWelcomeName] = useState(user?.full_name || '');
  const [welcomeBusy, setWelcomeBusy] = useState(false);
  const [welcomeError, setWelcomeError] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [parsedClasses, setParsedClasses] = useState([]);
  const [semesterInfo, setSemesterInfo] = useState({ name: '', start_date: '', end_date: '' });
  const [error, setError] = useState('');

  const handleFileChange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setError('');
    setParsing(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
      setFileUrl(file_url);
      const response = await base44.functions.invoke('parseTimetableUpload', { file_url });
      setParsedClasses(response.data?.classes || []);
      setStep(2);
    } catch (e) {
      setError('Could not parse the timetable. You can add classes manually instead.');
    }
    setParsing(false);
  };

  const handleConfirm = async () => {
    setParsing(true);
    setError('');
    try {
      const semester = await base44.entities.Semester.create({
        ...semesterInfo,
        is_active: true,
      });
      for (const cls of parsedClasses) {
        await base44.entities.Class.create({
          ...cls,
          semester_id: semester.id,
          color: cls.color || '#3B82F6',
        });
      }
      setStep(3);
    } catch (e) {
      setError('Failed to create semester. Please try again.');
    }
    setParsing(false);
  };

  const updateClass = (index, field, value) => {
    const updated = [...parsedClasses];
    updated[index] = { ...updated[index], [field]: value };
    setParsedClasses(updated);
  };

  const addManualClass = () => {
    setParsedClasses([...parsedClasses, {
      name: '', instructor: '', room: '', days_of_week: ['Mon'], start_time: '09:00', end_time: '10:00', color: '#3B82F6'
    }]);
  };

  if (step === 1) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1">
          <X className="w-4 h-4" /> Cancel
        </Link>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold mb-2">Set Up Your Semester</h1>
        <p className="text-muted-foreground text-sm mb-8">Upload a screenshot or PDF of your university timetable. AI will extract your classes automatically.</p>

        <label className="block">
          <div className="border-2 border-dashed border-border rounded-2xl p-10 text-center hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer">
            {parsing ? (
              <>
                <Loader2 className="w-10 h-10 text-primary mx-auto mb-3 animate-spin" />
                <p className="text-sm font-medium text-foreground">Parsing your timetable...</p>
                <p className="text-xs text-muted-foreground mt-1">This may take a few seconds</p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-7 h-7 text-primary" strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium text-foreground">Upload your timetable</p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WEBP, or PDF</p>
              </>
            )}
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileChange} disabled={parsing} />
          </div>
        </label>

        {error && <p className="text-sm text-destructive mt-4">{error}</p>}

        <div className="mt-6 text-center">
          <button onClick={addManualClass} className="text-sm text-primary font-medium hover:underline">
            Or add classes manually
          </button>
        </div>

        {parsedClasses.length > 0 && (
          <div className="mt-6">
            <button onClick={() => setStep(2)} className="w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90">
              Review {parsedClasses.length} Class{parsedClasses.length !== 1 ? 'es' : ''} →
            </button>
          </div>
        )}
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
        <Link to="/setup" className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1">
          <X className="w-4 h-4" /> Back
        </Link>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold mb-2">Review Your Classes</h1>
        <p className="text-muted-foreground text-sm mb-6">Confirm the extracted information and set your semester dates.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <input type="text" placeholder="Semester Name" value={semesterInfo.name}
            onChange={e => setSemesterInfo({ ...semesterInfo, name: e.target.value })}
            className="sm:col-span-3 px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          <input type="date" value={semesterInfo.start_date}
            onChange={e => setSemesterInfo({ ...semesterInfo, start_date: e.target.value })}
            className="px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          <input type="date" value={semesterInfo.end_date}
            onChange={e => setSemesterInfo({ ...semesterInfo, end_date: e.target.value })}
            className="px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
          <div />
        </div>

        <div className="space-y-3 mb-6">
          {parsedClasses.map((cls, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2">
                <input type="color" value={cls.color || '#3B82F6'} onChange={e => updateClass(i, 'color', e.target.value)}
                  className="w-8 h-8 rounded-lg cursor-pointer border border-border" />
                <input type="text" placeholder="Class name" value={cls.name}
                  onChange={e => updateClass(i, 'name', e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                <button onClick={() => setParsedClasses(parsedClasses.filter((_, idx) => idx !== i))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <input type="text" placeholder="Instructor" value={cls.instructor || ''}
                  onChange={e => updateClass(i, 'instructor', e.target.value)}
                  className="px-3 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                <input type="text" placeholder="Room" value={cls.room || ''}
                  onChange={e => updateClass(i, 'room', e.target.value)}
                  className="px-3 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                <input type="time" value={cls.start_time || ''}
                  onChange={e => updateClass(i, 'start_time', e.target.value)}
                  className="px-3 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
                <input type="time" value={cls.end_time || ''}
                  onChange={e => updateClass(i, 'end_time', e.target.value)}
                  className="px-3 py-2 rounded-lg border border-input bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/40" />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => {
                  const active = (cls.days_of_week || []).includes(day);
                  return (
                    <button key={day} onClick={() => {
                      const days = active ? (cls.days_of_week || []).filter(d => d !== day) : [...(cls.days_of_week || []), day];
                      updateClass(i, 'days_of_week', days);
                    }}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <button onClick={addManualClass} className="w-full py-3 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors flex items-center justify-center gap-1.5">
            <Plus className="w-4 h-4" /> Add Another Class
          </button>
        </div>

        {error && <p className="text-sm text-destructive mb-4">{error}</p>}

        <button onClick={handleConfirm} disabled={parsing || !semesterInfo.name || !semesterInfo.start_date || !semesterInfo.end_date || parsedClasses.length === 0}
          className="w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2">
          {parsing ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating Semester...</> : <><Check className="w-4 h-4" /> Confirm & Create Semester</>}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 lg:py-20 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-6">
        <Check className="w-8 h-8 text-emerald-600" strokeWidth={2} />
      </div>
      <h1 className="font-heading text-2xl font-bold mb-2">Semester Created!</h1>
      <p className="text-muted-foreground text-sm mb-8">Your classes have been added and your timeline is ready.</p>
      <Link to="/" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium text-sm hover:bg-primary/90">
        Go to Timeline <ChevronRight className="w-4 h-4" />
      </Link>
    </div>
  );
}