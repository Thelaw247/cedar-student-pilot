import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Mail, Lock, Loader2 } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import AuthLayout from "@/components/AuthLayout";
import AppleIcon from "@/components/AppleIcon";
import FacebookIcon from "@/components/FacebookIcon";
import { toast } from "@/components/ui/use-toast";
import { safeReturnTo } from "@/lib/authReturnTo";
import { LEGAL_VERSION } from "@/lib/legal";

const USE_SUPABASE = import.meta.env.VITE_BACKEND_MODE === "supabase";
const APPLE_AUTH_ENABLED = !USE_SUPABASE || import.meta.env.VITE_ENABLE_APPLE_AUTH === "true";
const FACEBOOK_AUTH_ENABLED = !USE_SUPABASE || import.meta.env.VITE_ENABLE_FACEBOOK_AUTH === "true";
const SOCIAL_AUTH_ENABLED = APPLE_AUTH_ENABLED || FACEBOOK_AUTH_ENABLED;

function registrationErrorMessage(error) {
  const message = typeof error?.message === "string" ? error.message.trim() : "";
  if (message && message !== "{}" && message !== "[object Object]") return message;
  if (error?.status >= 500) return "Registration is temporarily unavailable. Please try again shortly.";
  return "Registration failed. Please try again.";
}

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  // Unticked by default and never pre-ticked. A pre-checked consent box is not
  // consent, it is a dark pattern, and in several jurisdictions it is not valid
  // agreement at all.
  const [agreed, setAgreed] = useState(false);
  const [agreeError, setAgreeError] = useState(false);
  const agreeRef = useRef(null);

  // Every path that can create an account goes through this — the email form
  // and both social buttons. Supabase's OAuth sign-in creates the account on
  // first use, so gating only the form would leave the Apple and Facebook
  // buttons as a way to sign up having agreed to nothing.
  const requireAgreement = () => {
    if (agreed) return true;
    setAgreeError(true);
    setError("");
    agreeRef.current?.focus();
    return false;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!requireAgreement()) return;
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      // The version is recorded against the account, so what they agreed to is
      // provable later rather than assumed from the signup date.
      await base44.auth.register({ email, password, legalVersion: LEGAL_VERSION });
      setShowOtp(true);
    } catch (err) {
      setError(registrationErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setLoading(true);
    try {
      const result = await base44.auth.verifyOtp({ email, otpCode });
      if (result?.access_token) {
        base44.auth.setToken(result.access_token);
      }
      // A brand-new account lands on first-run onboarding (goal → promise →
      // plan, MON-04 §2); an explicit ?returnTo= still wins so deep links and
      // the OAuth consent flow keep working. Login is unchanged — onboarding
      // greets a person exactly once, at signup.
      const explicitReturn = new URLSearchParams(window.location.search).get('returnTo');
      window.location.href = explicitReturn ? safeReturnTo() : '/welcome';
    } catch (err) {
      setError(err.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError("");
    try {
      await base44.auth.resendOtp(email);
      toast({
        title: "Confirmation sent",
        description: "Check your email for the new confirmation message.",
      });
    } catch (err) {
      setError(err.message || "Failed to resend code");
    }
  };

  const handleApple = () => {
    if (!requireAgreement()) return;
    base44.auth.loginWithProvider("apple", safeReturnTo());
  };

  const handleFacebook = () => {
    if (!requireAgreement()) return;
    base44.auth.loginWithProvider("facebook", safeReturnTo());
  };

  if (showOtp) {
    return (
      <AuthLayout
        icon={Mail}
        title="Check your email"
        subtitle={`We sent a confirmation message to ${email}`}
      >
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
        {USE_SUPABASE && (
          <p className="mb-5 text-center text-sm text-muted-foreground">
            Open the confirmation link in the email. If the message contains a six-digit code instead,
            enter it below.
          </p>
        )}
        <div className="flex justify-center mb-6">
          <InputOTP
            maxLength={6}
            value={otpCode}
            onChange={setOtpCode}
            autoFocus
            autoComplete="one-time-code"
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>
        <Button
          className="w-full h-12 font-medium"
          onClick={handleVerify}
          disabled={loading || otpCode.length < 6}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            "Verify"
          )}
        </Button>
        <p className="text-center text-sm text-muted-foreground mt-4">
          Didn't receive the code?{" "}
          <button onClick={handleResend} className="text-primary font-medium hover:underline">
            Resend
          </button>
        </p>
        {USE_SUPABASE && (
          <p className="text-center text-sm text-muted-foreground mt-3">
            Already confirmed?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">
              Continue to log in
            </Link>
          </p>
        )}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      icon={UserPlus}
      title="Create your account"
      subtitle="Sign up to get started"
      footer={
        <>
          Already have an account?{" "}
          <Link to={`/login${window.location.search}`} className="text-primary font-medium hover:underline">
            Log in
          </Link>
        </>
      }
    >
      {SOCIAL_AUTH_ENABLED && (
        <>
          <div className={`grid gap-3 mb-6 ${APPLE_AUTH_ENABLED && FACEBOOK_AUTH_ENABLED ? "grid-cols-2" : "grid-cols-1"}`}>
            {APPLE_AUTH_ENABLED && (
              <Button variant="outline" className="h-12 text-sm font-medium" onClick={handleApple}>
                <AppleIcon className="w-5 h-5 mr-2" />
                Apple
              </Button>
            )}
            {FACEBOOK_AUTH_ENABLED && (
              <Button variant="outline" className="h-12 text-sm font-medium" onClick={handleFacebook}>
                <FacebookIcon className="w-5 h-5 mr-2" />
                Facebook
              </Button>
            )}
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-3 text-muted-foreground">or</span>
            </div>
          </div>
        </>
      )}

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
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
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm Password</Label>
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
        <div className="pt-1">
          <div className="flex items-start gap-3">
            <Checkbox
              id="legal-consent"
              ref={agreeRef}
              checked={agreed}
              onCheckedChange={(value) => {
                setAgreed(value === true);
                if (value === true) setAgreeError(false);
              }}
              aria-describedby={agreeError ? "legal-consent-error" : undefined}
              aria-invalid={agreeError || undefined}
              className={`mt-0.5 ${agreeError ? "border-destructive" : ""}`}
            />
            <Label htmlFor="legal-consent" className="text-sm font-normal leading-relaxed text-muted-foreground cursor-pointer">
              I agree to the{" "}
              <Link to="/terms" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link to="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">
                Privacy Policy
              </Link>
              .
            </Label>
          </div>
          {agreeError && (
            <p id="legal-consent-error" className="mt-2 ml-7 text-sm text-destructive">
              Please agree to the Terms of Service and Privacy Policy to create an account.
            </p>
          )}
        </div>

        {/* Deliberately NOT disabled while unticked. A dead button with no
            explanation is the most common accessibility failure on a signup
            form — the guard runs on submit and says what is missing instead. */}
        <Button type="submit" className="auth-cta w-full h-12 font-medium" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
