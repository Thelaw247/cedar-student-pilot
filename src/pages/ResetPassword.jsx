import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, AlertTriangle } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get("token");
  const useSupabase = import.meta.env.VITE_BACKEND_MODE === 'supabase';
  const [recoveryReady, setRecoveryReady] = useState(!useSupabase);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!useSupabase) return;
    let cancelled = false;
    base44.auth.hasRecoverySession()
      .then((valid) => { if (!cancelled) setHasRecoverySession(valid); })
      .finally(() => { if (!cancelled) setRecoveryReady(true); });
    return () => { cancelled = true; };
  }, [useSupabase]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      await base44.auth.resetPassword({ resetToken, newPassword });
      // It used to go straight to /login, with no word that anything had
      // worked; with Supabase the reset link has already signed the student
      // in, so the login page then bounced them on without saying so either.
      setDone(true);
    } catch (err) {
      setError(err.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    // Supabase: the recovery link is a sign-in, so the student is in already.
    // A full load rather than a route change, so the app reads that session
    // fresh instead of the recovery state this page was opened in.
    const next = useSupabase ? { href: "/today", label: "Continue to Praelecta" } : { href: "/login", label: "Sign in with your new password" };
    return (
      <AuthLayout icon={Lock} title="Password updated">
        <p role="status" className="text-sm text-foreground text-center mb-5">
          Your new password is saved. Use it the next time you sign in.
        </p>
        <Button asChild className="auth-cta w-full h-12 font-medium">
          <a href={next.href}>{next.label}</a>
        </Button>
      </AuthLayout>
    );
  }

  if (!recoveryReady) {
    return (
      <AuthLayout icon={Lock} title="Checking reset link" subtitle="One moment.">
        <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" aria-hidden="true" />
      </AuthLayout>
    );
  }

  if ((!useSupabase && !resetToken) || (useSupabase && !hasRecoverySession)) {
    return (
      <AuthLayout
        icon={AlertTriangle}
        title="This reset link doesn't work"
        subtitle="It has expired, was already used, or was cut short."
        footer={
          <Link to="/forgot-password" className="text-primary font-medium hover:underline">
            Request a new link
          </Link>
        }
      >
        <p className="text-sm text-foreground text-center">
          Each reset link works once. Ask for a new one and use the newest email.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={Lock}
      title="Choose a new password"
    >
      {error && (
        <div role="alert" className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              autoFocus
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm new password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="auth-cta w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
              Saving…
            </>
          ) : (
            "Save new password"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
