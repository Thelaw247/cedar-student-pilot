import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import RealProductPreview from '@/components/landing/RealProductPreview';

export default function LandingHero() {
  return (
    <section className="px-4 pb-20 pt-28 sm:px-6 sm:pt-32 lg:pb-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-semibold text-blue-600">Cedar Student Pilot</p>
          <h1 className="mx-auto mt-3 max-w-4xl text-balance text-4xl font-bold leading-[1.02] tracking-[-0.05em] text-slate-950 sm:text-5xl lg:text-6xl">
            One place for your classes, lectures, exams, and studying.
          </h1>
          <p className="mx-auto mt-5 max-w-3xl text-balance text-base leading-7 text-slate-600 sm:text-lg">
            Build your semester once. Record permitted lectures, keep what was taught, choose what an exam covers, and study from the same class with flashcards, practice questions, reviews, and a class handbook.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/register" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#2E66FF] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2459e8] sm:w-auto">
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#how-it-works" className="inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 sm:w-auto">
              See how it works
            </a>
          </div>
          <p className="mt-4 text-xs text-slate-400">No credit card required to start.</p>
        </div>

        <div className="mt-12 sm:mt-14">
          <RealProductPreview />
        </div>
      </div>
    </section>
  );
}
