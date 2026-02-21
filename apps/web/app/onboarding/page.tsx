'use client';

import { SkillLevelPicker } from '@/components/onboarding/SkillLevelPicker';

export default function OnboardingPage() {
  return (
    <div className="flex h-screen flex-col items-center justify-center px-6">
      <div className="mb-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome to VARYN
        </h1>
        <p className="mt-2 text-sm text-muted/70">
          Choose your experience level to get started.
        </p>
      </div>
      <SkillLevelPicker />
    </div>
  );
}
