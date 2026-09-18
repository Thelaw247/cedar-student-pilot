import React from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, LogOut, ShieldCheck } from 'lucide-react';

/**
 * The three billing facts a student wants before pressing a button that
 * might one day charge them: who takes the money, that leaving is one tap,
 * and that a failed action costs nothing. Shown under the primary CTA and
 * in the pricing section, and linked straight to the refund terms so the
 * policy is one click from the button rather than buried on the terms page.
 *
 * Text, not vendor logos: a wordmark drawn into the page is a trademark to
 * keep current; the names are what a student reads anyway.
 */
export default function PaymentTrustLine({ className = '' }) {
  return (
    <ul className={`mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground ${className}`}>
      <li className="inline-flex items-center gap-1.5">
        <CreditCard className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        Secure checkout by Stripe · card, Apple Pay or Google Pay
      </li>
      <li className="inline-flex items-center gap-1.5">
        <LogOut className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        Cancel anytime, in one tap
      </li>
      <li className="inline-flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        No charge for failed actions ·{' '}
        <Link to="/terms#refunds" className="font-medium text-foreground/80 hover:text-foreground">refund policy</Link>
      </li>
    </ul>
  );
}
