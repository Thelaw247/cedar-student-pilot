import React from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronLeft, FileText, UserCheck, Mic, CreditCard, RefreshCw,
  ShieldCheck, Sparkles, Ban, Server, AlertTriangle, Scale, Mail,
} from 'lucide-react';
import { TIERS, TIER_ORDER, CREDIT_PACKS, CREDIT_COSTS } from '@/lib/tiers';
import { TERMS_EFFECTIVE_DATE } from '@/lib/legal';

// Shown to users, and shared with lib/legal.js so the recorded consent
// version and the date on this page cannot drift apart.
const EFFECTIVE_DATE = TERMS_EFFECTIVE_DATE;

// Naming the province is better than the generic fallback used when this is
// null — it decides which courts hear a dispute and which consumer-protection
// statute applies. Set it once and the sentence below rewrites itself. Left
// null the wording stays accurate but unspecific, which is preferable to
// inventing a jurisdiction the business does not actually operate from.
const GOVERNING_PROVINCE = null; // e.g. 'Ontario'

// Prices, credit grants and credit costs are read from lib/tiers.js rather than
// written out here. A terms page that quotes a price is a terms page that goes
// stale the first time the price changes, and a stale price in a legal document
// is worse than no price at all.
const money = (n) => `$${n.toFixed(2)}`;
const paidTiers = TIER_ORDER.filter((id) => id !== 'free').map((id) => TIERS[id]);

export default function Terms() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 lg:py-10 animate-fade-in">
      <Link to="/settings" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1">
        <ChevronLeft className="w-4 h-4" /> Settings
      </Link>

      <div className="flex items-start gap-3 mb-2">
        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <FileText className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="font-heading text-2xl font-bold">Terms of Service</h1>
          <p className="text-xs text-muted-foreground mt-1">Effective {EFFECTIVE_DATE}</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground leading-relaxed mb-8">
        These are the terms you agree to by using Praelecta. They’re written to be read once and understood, not to
        hide anything in the middle. The short version: your recordings and notes are yours, you’re responsible for
        having permission to record, we charge what the pricing page says and never quietly more, and you can cancel
        in two clicks without talking to anyone. For what we do with your data, see the{' '}
        <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
      </p>

      <Section icon={UserCheck} title="Your account">
        <p>
          You need an account to use Praelecta, and it belongs to one person — you. Keep your sign-in details to
          yourself; anything done through your account is treated as done by you. If you think someone else has access,
          change your password and tell us.
        </p>
        <p>
          You need to be old enough to agree to a contract where you live. If you aren’t, a parent or guardian has to
          agree to these terms on your behalf.
        </p>
      </Section>

      <Section icon={Mic} title="Recording lectures is your responsibility">
        <p>
          This is the most important thing on this page. Praelecta records audio because you tell it to, and{' '}
          <span className="font-medium text-foreground">you are the one responsible for having the right to make that
          recording</span>. That means your instructor’s permission, your school’s policy on recording class, and the
          law where you are.
        </p>
        <p>
          The app asks you to confirm you have permission before your first recording in each class. That confirmation
          is you telling us it’s allowed — we have no way to check, and we don’t. If permission is refused or
          withdrawn, stop recording that class and delete what you’ve already captured.
        </p>
        <p>
          Recordings are for your own study. Don’t republish, sell, or circulate a lecture recording or transcript —
          that’s your instructor’s work, and in most places it’s theirs to control.
        </p>
      </Section>

      <Section icon={CreditCard} title="Plans, credits and what things cost">
        <p>
          Praelecta runs on credits. A plan grants credits each month; features spend them. All prices are in Canadian
          dollars and shown before you pay.
        </p>
        <div className="scroll-x overflow-x-auto -mx-1 px-1 mt-3">
          <table className="w-full text-xs border-collapse min-w-[380px]">
            <thead>
              <tr className="text-muted-foreground">
                <th className="text-left font-medium py-1.5 pr-3">Plan</th>
                <th className="text-right font-medium py-1.5 px-3">Monthly</th>
                <th className="text-right font-medium py-1.5 px-3">Semester</th>
                <th className="text-right font-medium py-1.5 pl-3">Credits/mo</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <td className="py-1.5 pr-3 text-foreground font-medium">{TIERS.free.name}</td>
                <td className="py-1.5 px-3 text-right">Free</td>
                <td className="py-1.5 px-3 text-right">Free</td>
                <td className="py-1.5 pl-3 text-right">{TIERS.free.creditsPerMonth} once</td>
              </tr>
              {paidTiers.map((t) => (
                <tr key={t.id} className="border-t border-border">
                  <td className="py-1.5 pr-3 text-foreground font-medium">{t.name}</td>
                  <td className="py-1.5 px-3 text-right">{money(t.monthly)}</td>
                  <td className="py-1.5 px-3 text-right">{money(t.semester)}</td>
                  <td className="py-1.5 pl-3 text-right">{t.creditsPerMonth}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3">
          Credit packs are one-off top-ups that don’t change your plan:{' '}
          {CREDIT_PACKS.map((p, i) => (
            <span key={p.id}>
              {i > 0 ? (i === CREDIT_PACKS.length - 1 ? ' and ' : ', ') : ''}
              {p.credits} credits for {money(p.price)}
            </span>
          ))}.
        </p>
        <p>
          Recording and processing a lecture costs {CREDIT_COSTS.perThirtyMinutes.process_lecture} credits per 30
          minutes of audio, and a cleaned transcript costs {CREDIT_COSTS.perThirtyMinutes.clean_transcript} per 30
          minutes. Everything else is a flat cost shown in the app before you spend it. You are never charged credits
          for something that fails.
        </p>
        <p>
          <span className="font-medium text-foreground">Two things worth knowing about how credits behave.</span>{' '}
          Monthly plan credits reset at the start of each billing month — they don’t roll over. Credits you bought in a
          pack do not expire, and they survive a downgrade or cancellation. When you spend, plan credits are used first
          so the ones that expire go first, and the ones you paid extra for stay.
        </p>
        <p>
          The Free plan’s {TIERS.free.creditsPerMonth} credits are a one-time grant, not a monthly allowance. The
          {' '}{TIERS.unlimited.name} plan is subject to fair use of{' '}
          {TIERS.unlimited.fairUseHoursPerSemester} recorded hours per semester; if you get near it we’ll contact you
          rather than cut you off.
        </p>
      </Section>

      <Section icon={RefreshCw} title="Renewal, cancellation and refunds">
        <p>
          Plans renew automatically until you cancel — monthly plans every month, semester plans every four months.
          The renewal price is the price you signed up at. We’ll email you before anything changes.
        </p>
        <p>
          <span className="font-medium text-foreground">Cancelling takes two clicks</span>, in Settings → Subscription,
          which opens your billing portal. No phone call, no email to support, no offer you have to decline three times
          on the way out. Cancelling stops the next renewal and you keep everything you’ve paid for until the end of the
          period you already bought. There is no cancellation fee.
        </p>
        <p>
          Refunds: if something we charged you for didn’t work, tell us and we’ll refund it. Beyond that, nothing here
          limits the refund and cancellation rights you have under Canadian consumer protection law, which apply
          whatever this page says.
        </p>
      </Section>

      <Section icon={ShieldCheck} title="The grandfather promise">
        <p>
          If you subscribe at a price, that is your price for as long as you stay subscribed. If a plan’s features are
          later reduced, that reduction doesn’t apply to you. We add and improve; we don’t take back what you already
          bought.
        </p>
        <p>
          Prices for <span className="italic">new</span> subscribers can change, and a plan can be retired for new
          sign-ups. Neither moves you. If we ever have to end a plan you’re on entirely, we’ll give you notice and a
          refund of the unused part of what you paid.
        </p>
      </Section>

      <Section icon={FileText} title="Your content stays yours">
        <p>
          Your recordings, transcripts, notes and study history belong to you. You give us only the permission we need
          to actually run the service for you — to store your files, send audio and text to the AI providers that
          transcribe and summarize it, and show the results back to you. That’s the whole licence, and it ends when you
          delete the content or your account.
        </p>
        <p>
          We don’t sell your content, don’t show it to other users, and don’t use it to advertise to you. You can export
          everything or delete everything at any time from Settings → Data &amp; Privacy.
        </p>
      </Section>

      <Section icon={Sparkles} title="What the AI can and can’t do">
        <p>
          Transcripts, summaries, flashcards, predicted exam topics and study schedules are generated automatically.
          They are usually good and they are sometimes wrong — a misheard word, a missed point, a confident guess about
          what’s on the exam. Treat them as a study aid built from your lecture, not as an authority, and check anything
          that matters against your own notes and course materials.
        </p>
        <p>
          Exam topic prediction is a ranking of what the material emphasises. It is not insider knowledge of your exam
          and we make no promise about your results.
        </p>
        <p>
          Praelecta is for studying. Submitting AI-generated text as your own work is between you and your school’s
          academic integrity rules, and most schools treat it seriously. Don’t use us to do that.
        </p>
      </Section>

      <Section icon={Ban} title="Things you agree not to do">
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Record anyone without the permission you’re required to have.</li>
          <li>Upload content you don’t have the right to, or that’s unlawful.</li>
          <li>Share one account between people, or resell access.</li>
          <li>Try to break, overload, scrape or reverse-engineer the service, or work around credit limits.</li>
          <li>Use Praelecta to help someone cheat.</li>
        </ul>
        <p className="mt-2">
          If an account is doing one of these we may suspend it. Where it’s something fixable, we’ll tell you what the
          problem is first and give you a chance to fix it.
        </p>
      </Section>

      <Section icon={Server} title="Availability and changes">
        <p>
          We aim to keep Praelecta running and your data safe, but no online service is up every minute. Features may
          be added, changed or withdrawn — subject to the grandfather promise above.
        </p>
        <p>
          If we change these terms in a way that materially affects you, we’ll tell you before it takes effect and
          update the date at the top. Continuing to use Praelecta after that means you accept the change; if you don’t,
          you can cancel and we’ll refund the unused part of your current period.
        </p>
      </Section>

      <Section icon={AlertTriangle} title="Limits on our liability">
        <p>
          Praelecta is provided as it is. We don’t guarantee that transcripts are accurate, that the service is
          uninterrupted, or that using it will improve your grades.
        </p>
        <p>
          To the extent the law allows, we aren’t liable for indirect or consequential losses — a missed deadline, a
          failed exam, lost study time — and our total liability to you is limited to what you paid us in the twelve
          months before the claim. Nothing here excludes liability that cannot legally be excluded, including under
          consumer protection law.
        </p>
      </Section>

      <Section icon={Scale} title="Governing law">
        <p>
          {GOVERNING_PROVINCE
            ? `These terms are governed by the laws of the Province of ${GOVERNING_PROVINCE} and the federal laws of Canada that apply there, and disputes belong to the courts of ${GOVERNING_PROVINCE}.`
            : 'These terms are governed by the laws of Canada and of the province in which Praelecta is operated.'}
          {' '}This doesn’t take away your right to bring a claim where you live, if the law where you live gives you
          that right.
        </p>
      </Section>

      <Section icon={Mail} title="Contact">
        <p>
          Questions about these terms, a billing problem, or something that doesn’t look right? Reach out through the
          in-app support link and a person will answer.
        </p>
      </Section>

      <p className="text-center text-xs text-muted-foreground mt-8 mb-4">
        Praelecta • Terms of Service • {EFFECTIVE_DATE} • <Link to="/privacy" className="hover:text-foreground">Privacy Policy</Link>
      </p>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-primary" strokeWidth={2} />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">
        {children}
      </div>
    </div>
  );
}
