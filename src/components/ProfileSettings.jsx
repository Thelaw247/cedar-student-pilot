import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { User, Mail, Lock, Check, Loader2, LogOut, AlertCircle } from 'lucide-react';

/**
 * Profile management: display name, email, password, sign out.
 *
 * Uses base44.auth.updateMe() and base44.auth.changePassword() from the SDK.
 * Email is read-only — it is the account identifier and changing it is an
 * auth-provider concern, not a profile edit.
 */
export default function ProfileSettings() {
  const { user, logout, checkUserAuth } = useAuth();
  const [name, setName] = useState(user?.full_name || '');
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState(null);

  const [showPw, setShowPw] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);
  const [pwError, setPwError] = useState(null);

  const dirty = name.trim() !== (user?.full_name || '').trim();

  const saveName = async () => {
    if (!dirty || !name.trim()) return;
    setSavingName(true); setNameError(null); setNameSaved(false);
    try {
      await base44.auth.updateMe({ full_name: name.trim() });
      await checkUserAuth();          // refresh the cached user in context
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2000);
    } catch (e) {
      console.error(e);
      setNameError('Could not save your name. Please try again.');
    }
    setSavingName(false);
  };

  const changePassword = async () => {
    setPwError(null); setPwMsg(null);
    if (newPw.length < 8) { setPwError('Use at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setPwError('The new passwords don’t match.'); return; }
    setPwBusy(true);
    try {
      await base44.auth.changePassword({
        userId: user.id, currentPassword: currentPw, newPassword: newPw,
      });
      setPwMsg('Password updated.');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setTimeout(() => { setShowPw(false); setPwMsg(null); }, 1800);
    } catch (e) {
      console.error(e);
      setPwError(e?.message || 'Could not change your password. Check your current password.');
    }
    setPwBusy(false);
  };

  const field = 'w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40';

  return (
    <div className="space-y-5">
      {/* Identity */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <User className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{user?.full_name || 'Your account'}</p>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        </div>
      </div>

      {/* Display name */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Display name</label>
        <div className="flex gap-2">
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder="Your name" className={field} />
          <button onClick={saveName} disabled={!dirty || savingName || !name.trim()}
            className="px-3 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-40 flex-shrink-0">
            {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : nameSaved ? <Check className="w-4 h-4" /> : 'Save'}
          </button>
        </div>
        {nameError && <p className="text-[11px] text-destructive mt-1.5">{nameError}</p>}
      </div>

      {/* Email — read only */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="email" value={user?.email || ''} readOnly
            className={`${field} pl-10 opacity-60 cursor-not-allowed`} />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Your email identifies the account and can&rsquo;t be changed here.
        </p>
      </div>

      {/* Password */}
      <div>
        {!showPw ? (
          <button onClick={() => setShowPw(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Lock className="w-3.5 h-3.5" /> Change password
          </button>
        ) : (
          <div className="rounded-lg border border-border p-3 space-y-2">
            <p className="text-xs font-medium">Change password</p>
            <input type="password" placeholder="Current password" autoComplete="current-password"
              value={currentPw} onChange={e => setCurrentPw(e.target.value)} className={field} />
            <input type="password" placeholder="New password (min 8 characters)" autoComplete="new-password"
              value={newPw} onChange={e => setNewPw(e.target.value)} className={field} />
            <input type="password" placeholder="Confirm new password" autoComplete="new-password"
              value={confirmPw} onChange={e => setConfirmPw(e.target.value)} className={field} />
            {pwError && (
              <p className="text-[11px] text-destructive flex items-start gap-1.5">
                <AlertCircle className="w-3 h-3 mt-px flex-shrink-0" />{pwError}
              </p>
            )}
            {pwMsg && <p className="text-[11px] text-emerald-600">{pwMsg}</p>}
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setShowPw(false); setPwError(null); setCurrentPw(''); setNewPw(''); setConfirmPw(''); }}
                className="flex-1 px-3 py-2 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:bg-muted">
                Cancel
              </button>
              <button onClick={changePassword} disabled={pwBusy || !currentPw || !newPw}
                className="flex-1 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50">
                {pwBusy ? 'Saving…' : 'Update password'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sign out */}
      <div className="pt-2 border-t border-border">
        <button onClick={() => logout()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </div>
  );
}
