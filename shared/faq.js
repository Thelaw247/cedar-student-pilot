import { TIERS, CREDIT_COSTS, hoursFrom } from './tiers.js';

/**
 * The questions a student asks before signing up, answered once.
 *
 * Rendered on the landing page (LandingFaq) and mirrored as FAQPage JSON-LD in
 * index.html so search engines and answer engines read the same words; a test
 * holds the two copies together. Every answer states something the product
 * actually does (the permission gate, the named providers, the credit costs,
 * the cancel path) in the words a student would use, and reads its numbers
 * from tiers.js so a price change cannot leave a stale figure here.
 */

const money = (n) => `$${n.toFixed(2)}`;
const perHour = CREDIT_COSTS.perThirtyMinutes.process_lecture * 2;

export const FAQ = [
  {
    id: 'allowed',
    question: 'Is recording lectures allowed?',
    answer: `It depends on your university and your professor: some allow it, some want to be asked first, some don't. Praelecta asks you to confirm you have permission before your first recording in each class, and it never starts a recording on its own.`,
  },
  {
    id: 'audio',
    question: 'What happens to my audio?',
    answer: `It goes into your account's private storage and is transcribed by Groq (Deepgram as a backup); Google's Gemini then writes the summary, concepts and questions. Those providers process it only to return your results and, under their terms, don't use it to train their models. No other user can see it, we never sell it, and it's deleted when you delete the lecture, the class, or your account.`,
  },
  {
    id: 'credits',
    question: 'Will I run out of credits mid-semester?',
    answer: `You always see your balance and what an action costs before you spend it, so it's never a surprise. A one-hour lecture is ${perHour} credits. Student gives you ${TIERS.student.creditsPerMonth} a month (about ${hoursFrom(TIERS.student.creditsPerMonth)} hours of lectures), Scholar ${TIERS.scholar.creditsPerMonth}, Unlimited ${TIERS.unlimited.creditsPerMonth}. If you need more, a credit pack tops you up without changing your plan, and packs never expire.`,
  },
  {
    id: 'cancel',
    question: 'Can I cancel anytime?',
    answer: `Yes, from Settings: Manage billing opens Stripe's billing portal, where you cancel yourself, with no email or chat with support. You keep what you paid for until the end of the period, everything you made stays in your account, and your price never goes up while you're subscribed.`,
  },
  {
    id: 'essays',
    question: 'Does Praelecta write my essays?',
    answer: `No. It works from your lectures and the course files you attach, like a syllabus or a past exam. It doesn't write assignments, and there's nowhere in the app to ask it to.`,
  },
  {
    id: 'fast',
    question: 'What if my professor talks too fast?',
    answer: `Record it and replay any part with the transcript right beside it. The summary and key concepts are usually ready about three minutes after you stop recording, so you can listen in class instead of racing to write.`,
  },
  {
    id: 'devices',
    question: 'Does it work on iPhone or Mac?',
    answer: `Yes. Praelecta runs in the browser on any phone or laptop, iPhone included: sign in at praelecta.ca. There's also a desktop app for Mac, Windows and Linux, and an iPhone app is on the way.`,
  },
  {
    id: 'price',
    question: 'How much does it cost?',
    answer: `Two full lectures of up to 90 minutes are free, no card needed. After that, Student is ${money(TIERS.student.monthly)} a month or ${money(TIERS.student.semester)} for the whole semester, one bill that matches your term. Scholar is ${money(TIERS.scholar.monthly)} a month or ${money(TIERS.scholar.semester)} a semester, Unlimited ${money(TIERS.unlimited.monthly)} or ${money(TIERS.unlimited.semester)}. The full comparison is on the pricing page.`,
  },
];

/** The same list as schema.org FAQPage JSON-LD, for index.html and its test. */
export function faqJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}
