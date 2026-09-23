import React from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, CreditCard, LogOut, ShieldCheck } from 'lucide-react';
import { moneyBackGuarantee } from '@/lib/legal';

/**
 * The three billing facts a student wants before pressing a button that
 * might one day charge them: who takes the money, that leaving is one tap,
 * and that a failed action costs nothing. Shown under the primary CTA and
 * in the pricing section, and linked straight to the refund terms so the
 * policy is one click from the button rather than buried on the terms page.
 *
 * Text, not vendor logos: a wordmark drawn into the page is a trademark to
 * keep current; the names are what a student reads anyway.
 *
 * The money-back line underneath renders only once a guarantee exists
 * (MONEY_BACK_DAYS in lib/legal.js); it is the same sentence the terms
 * carry, so the button never promises what the terms do not.
 */
export default function PaymentTrustLine({ className = '' }) {
  const guarantee = moneyBackGuarantee();
  return (
    <div className={className}>
      <ul className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
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
      {guarantee && (
        <p className="mx-auto mt-2 flex max-w-3xl items-center justify-center gap-1.5 text-center text-xs font-medium text-foreground/85">
          <BadgeCheck className="h-3.5 w-3.5 flex-none text-primary" aria-hidden="true" />
          <Link to="/terms#refunds" className="hover:text-foreground">{guarantee}</Link>
        </p>
      )}
    </div>
  );
}
