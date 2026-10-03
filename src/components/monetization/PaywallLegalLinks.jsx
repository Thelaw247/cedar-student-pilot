import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Terms, Privacy and the refund policy, beside every button that starts a
 * payment. The paywalls linked the refund policy alone, so the two documents a
 * plan is sold under were a footer away from the moment someone decides to
 * buy it.
 *
 * `onNavigate` closes the sheet a link is followed from.
 */
export default function PaywallLegalLinks({ onNavigate = undefined }) {
  const link = 'underline hover:text-foreground';
  return (
    <>
      <Link to="/terms" onClick={onNavigate} className={link}>Terms</Link>
      {' · '}
      <Link to="/privacy" onClick={onNavigate} className={link}>Privacy</Link>
      {' · '}
      <Link to="/terms#refunds" onClick={onNavigate} className={link}>Refund policy</Link>
    </>
  );
}
