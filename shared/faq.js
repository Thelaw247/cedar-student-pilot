import { TIERS, CREDIT_COSTS, CREDITS_PER_LECTURE } from './tiers.js';

/**
 * The questions a student asks before signing up, answered once.
 *
 * Rendered on the landing page (LandingFaq) and mirrored as FAQPage JSON-LD in
 * index.html so search engines and answer engines read the same words; a test
 * holds the two copies together. Every answer states something the product
 * actually does — the permission gate, the named providers, the credit costs,
 * the one-tap cancel — in the words a student would use, and reads its numbers
 * from tiers.js so a price change cannot leave a stale figure here.
 */

const money = (n) => `$${n.toFixed(2)}`;
const lecturesFrom = (credits) => Math.floor(credits / CREDITS_PER_LECTURE);
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
    answer: `It goes into your account's private storage and is transcribed by Groq (Deepgram as a backup); Google's Gemini then writes the summary, concepts and questions. Those providers process it only to return your results and, under their terms, don't use it to train their models. Nobody else can see it, we never sell it, and it's deleted when you delete the lecture, the class, or your account.`,
  },
  {
    id: 'credits',
    question: 'Will I run out of credits mid-semester?',
    answer: `You always see your balance and what an action costs before you spend it, so it's never a surprise. A one-hour lecture is ${perHour} credits. Student gives you ${TIERS.student.creditsPerMonth} a month (about ${lecturesFrom(TIERS.student.creditsPerMonth)} lectures), Scholar ${TIERS.scholar.creditsPerMonth}, Unlimited ${TIERS.unlimited.creditsPerMonth}. If you need more, a credit pack tops you up without changing your plan, and packs never expire.`,
  },
  {
    id: 'cancel',
    question: 'Can I cancel anytime?',
    answer: `Yes. One tap in Settings, no chat with support. You keep what you paid for until the end of the period, everything you made stays in your account, and your price never goes up while you're subscribed.`,
  },
  {
    id: 'essays',
    question: 'Does Praelecta write my essays?',
    answer: `No. It only works with your lectures: the recording, the transcript and what your professor actually said. It doesn't write assignments, and there's nowhere in the app to ask it to.`,
  },
  {
    id: 'fast',
    question: 'What if my professor talks too fast?',
    answer: `Record it and replay any part with the transcript right beside it. The summary and key concepts are ready a few minutes after class ends, so you can listen in class instead of racing to write.`,
  },
  {
    id: 'devices',
    question: 'Does it work on iPhone or Mac?',
    answer: `Praelecta runs in the browser on any phone or laptop, iPhone and Mac included: sign in at praelecta.ca. There's a desktop app for Windows and Linux today; the Mac app and the iPhone app are on the way.`,
  },
  {
    id: 'price',
    question: 'How much does it cost?',
    answer: `Two full lectures are free, no card needed. After that, Student is ${money(TIERS.student.monthly)} a month or ${money(TIERS.student.semester)} for the whole semester, one bill that matches your term. Scholar is ${money(TIERS.scholar.monthly)} a month or ${money(TIERS.scholar.semester)} a semester, Unlimited ${money(TIERS.unlimited.monthly)} or ${money(TIERS.unlimited.semester)}. The full comparison is on the pricing page.`,
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
