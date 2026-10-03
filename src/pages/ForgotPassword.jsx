import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";
import { SUPPORT_EMAIL } from "@/lib/legal";

/**
 * True when the email was never handed to the server: no connection, or the
 * server itself failing. Only then does the page say so.
 *
 * Every answer about the address itself is shown as success, and that has to
 * stay true. Supabase answers an unknown address with a plain success, but a
 * known one asked twice within a minute with "too many requests", so showing
 * 4xx errors would let anyone find out who has an account. A 5xx is shown even
 * though the mail provider failing is one way to get it for a real account
 * only: a student whose email is not coming has to be told, and that leak
 * lasts only as long as the outage. This used to swallow every error,
 * including a dropped connection, and promised an email that was never sent
 * (Oct 2026).
 */
function emailNeverSent(err) {
  const status = Number(err?.status) || 0;
  return status >= 500 || err?.name === "AuthRetryableFetchError" || err?.name === "TypeError";
}

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await base44.auth.resetPasswordRequest(email);
      setSent(true);
    } catch (err) {
      if (emailNeverSent(err)) {
        setError(`The email couldn't be sent just now. Check your connection and try again in a minute. If it keeps happening, write to ${SUPPORT_EMAIL}.`);
      } else {
        setSent(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={Mail}
      title="Reset your password"
      subtitle="We'll email you a link to choose a new one."
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline">
          <ArrowLeft className="w-3 h-3 inline mr-1" aria-hidden="true" />Back to sign in
        </Link>
      }
    >
      {sent ? (
        <p role="status" className="text-sm text-foreground text-center">
          If there&rsquo;s an account for {email}, a reset link is on its way. It can take a minute, and it may land in
          your spam folder.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-12"
                required
              />
            </div>
          </div>
          <Button type="submit" className="auth-cta w-full h-12 font-medium" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden="true" />
                Sending…
              </>
            ) : (
              "Send reset link"
            )}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
