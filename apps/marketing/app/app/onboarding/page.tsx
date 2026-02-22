'use client';

import { SkillLevelPicker } from '@/components/onboarding/SkillLevelPicker';

export default function OnboardingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      {/* Subtle gradient background accent */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-1/2 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-indigo-500/[0.03] rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-[400px] h-[300px] bg-emerald-500/[0.02] rounded-full blur-3xl" />
      </div>

      <div className="relative mb-12 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] text-muted/50 uppercase tracking-widest">
          <span className="h-1.5 w-1.5 rounded-full bg-accent/60 animate-pulse" />
          Getting started
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Welcome to VARYN
        </h1>
        <p className="mt-3 text-sm text-muted/60 max-w-md mx-auto leading-relaxed">
          A statistical workspace that adapts to your skill level. Choose how you work best.
        </p>
      </div>

      <SkillLevelPicker />

      <p className="mt-10 text-[11px] text-muted/30 max-w-sm text-center">
        You can change your skill level at any time from the File menu.
      </p>
    </div>
  );
}
